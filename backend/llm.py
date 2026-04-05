import config_env  # noqa: F401 — ensure .env loaded before reading API key

import base64
import io
import json
import os
import re
from pathlib import Path
from typing import Any, Optional, Tuple

import httpx
from google import genai

_BACKEND_DIR = Path(__file__).resolve().parent

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()
# These IDs return 404 for generateContent on the AI Studio API; ignore if set in .env.
_LEGACY_MODELS_SKIP = frozenset(
    {
        "gemini-1.5-flash-8b",
        "models/gemini-1.5-flash-8b",
    }
)

# Try stable v1 first, then v1beta (model availability differs by API version).
_DEFAULT_REST_BASES = (
    "https://generativelanguage.googleapis.com/v1",
    "https://generativelanguage.googleapis.com/v1beta",
)

_client = None


def get_api_key() -> str:
    raw = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if raw.startswith("\ufeff"):
        raw = raw.lstrip("\ufeff").strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
        raw = raw[1:-1].strip()
    return raw


def get_client():
    global _client
    key = get_api_key()
    if not key:
        return None
    if _client is None:
        _client = genai.Client(api_key=key)
    return _client


def _rest_bases() -> list[str]:
    custom = (os.getenv("GEMINI_API_BASE") or "").strip().rstrip("/")
    if custom:
        return [custom]
    return list(_DEFAULT_REST_BASES)


def _default_models() -> list[str]:
    # gemini-1.5-flash-8b was removed from generateContent for many keys — do not use.
    # Order: widely available flash models, then Pro fallback.
    return [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-pro",
    ]


def _models_to_try() -> list[str]:
    defaults = _default_models()
    if not GEMINI_MODEL or GEMINI_MODEL in _LEGACY_MODELS_SKIP:
        return defaults
    m = GEMINI_MODEL.removeprefix("models/")
    if m in _LEGACY_MODELS_SKIP:
        return defaults
    # Prefer user-selected model first, then other defaults as fallback.
    return [m] + [x for x in defaults if x != m]


def _parse_rest_candidate(data: dict) -> Tuple[str, Optional[str]]:
    """Extract model text from REST JSON; return (text, error_hint)."""
    if "error" in data:
        err = data["error"]
        msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
        return "", msg
    fb = data.get("promptFeedback") or {}
    if fb.get("blockReason"):
        return "", f"prompt blocked: {fb.get('blockReason')}"
    cands = data.get("candidates") or []
    if not cands:
        return "", "no candidates (empty or filtered response)"
    c0 = cands[0]
    fr = c0.get("finishReason")
    if fr and fr not in ("STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED", None):
        # Still try to read partial text
        pass
    content = c0.get("content") or {}
    parts = content.get("parts") or []
    chunks = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")]
    text = "".join(chunks).strip()
    if text:
        return text, None
    return "", f"no text in response (finish={fr})"


def _response_text_sdk(response) -> str:
    if response is None:
        return ""
    try:
        t = response.text
        if t and str(t).strip():
            return str(t).strip()
    except Exception:
        pass
    try:
        cands = getattr(response, "candidates", None) or []
        if not cands:
            return ""
        content = cands[0].content
        if not content or not content.parts:
            return ""
        chunks = []
        for p in content.parts:
            if getattr(p, "text", None):
                chunks.append(p.text)
        return "".join(chunks).strip()
    except Exception:
        return ""


def _parts_include_image(parts: list) -> bool:
    for p in parts:
        if isinstance(p, dict) and ("inline_data" in p or "inlineData" in p):
            return True
    return False


def _normalize_inline_image_part(mime_type: str, b64: str) -> dict:
    """Generative Language REST JSON uses camelCase (proto JSON mapping)."""
    return {
        "inlineData": {
            "mimeType": mime_type,
            "data": b64,
        }
    }


def _parts_with_snake_case_inline(parts: list) -> Optional[list]:
    """Alternate REST shape for environments that expect snake_case image parts."""
    out: list = []
    changed = False
    for p in parts:
        if isinstance(p, dict) and "inlineData" in p:
            changed = True
            idata = p["inlineData"]
            out.append(
                {
                    "inline_data": {
                        "mime_type": idata.get("mimeType", "image/jpeg"),
                        "data": idata.get("data", ""),
                    }
                }
            )
        else:
            out.append(p)
    return out if changed else None


def _resize_image_for_gemini_vision(image_bytes: bytes) -> tuple[bytes, str]:
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    max_side = int(os.getenv("GEMINI_VISION_MAX_SIDE", "1536"))
    img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue(), "image/jpeg"


async def gemini_generate_from_parts(
    parts: list,
    max_output_tokens: int = 1024,
    temperature: float = 0.55,
) -> Tuple[str, Optional[str]]:
    """
    Multimodal-capable Gemini call via REST; optional SDK fallback for text-only requests.
    """
    key = get_api_key()
    if not key:
        return "", "missing GEMINI_API_KEY or GOOGLE_API_KEY in .env"

    last_err: Optional[str] = None
    has_image = _parts_include_image(parts)
    timeout = 180.0 if has_image else 120.0

    async with httpx.AsyncClient(timeout=timeout) as http:
        for base in _rest_bases():
            for model in _models_to_try():
                url = f"{base}/models/{model}:generateContent"
                try:
                    r = await http.post(
                        url,
                        params={"key": key},
                        json={
                            "contents": [{"role": "user", "parts": parts}],
                            "generationConfig": {
                                "temperature": temperature,
                                "maxOutputTokens": max_output_tokens,
                            },
                        },
                    )
                    if r.status_code != 200:
                        if has_image and r.status_code == 400:
                            alt = _parts_with_snake_case_inline(parts)
                            if alt is not None:
                                r = await http.post(
                                    url,
                                    params={"key": key},
                                    json={
                                        "contents": [{"role": "user", "parts": alt}],
                                        "generationConfig": {
                                            "temperature": temperature,
                                            "maxOutputTokens": max_output_tokens,
                                        },
                                    },
                                )
                        if r.status_code != 200:
                            last_err = (
                                f"{base.split('/')[-1]}/{model} HTTP {r.status_code}: {r.text[:500]}"
                            )
                            continue
                    data = r.json()
                    text, hint = _parse_rest_candidate(data)
                    if text:
                        return text, None
                    last_err = hint or f"{model}: empty body"
                except httpx.RequestError as e:
                    last_err = f"{model}: {e}"

    if not has_image:
        client = get_client()
        if client:
            for model in _models_to_try():
                try:
                    text_part = next(
                        (p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")),
                        "",
                    )
                    response = await client.aio.models.generate_content(
                        model=model,
                        contents=text_part,
                    )
                    text = _response_text_sdk(response)
                    if text:
                        return text, None
                except Exception as e:
                    last_err = str(e)

    return "", last_err or "all Gemini paths failed"


async def gemini_generate_text(prompt: str, max_output_tokens: int = 1024) -> Tuple[str, Optional[str]]:
    return await gemini_generate_from_parts(
        [{"text": prompt}],
        max_output_tokens=max_output_tokens,
        temperature=0.55,
    )


_LABEL_VISION_PROMPT = """You are reading a packaged food, drink, or supplement label photo.

Find the ingredients section (headers may be INGREDIENTS, INGREDIENTES, Zutaten, Contains, May contain, etc.).
Transcribe the full ingredient list as plain text: comma-separated phrases in the same order as on the label.
Include parenthetical details (e.g. vitamins, sub-ingredients) inside the same line.

If no ingredients block is visible, transcribe all readable product text you can see in one paragraph.

Output rules: plain text only — no markdown, bullets, or commentary."""


async def gemini_read_label_text(
    image_bytes: bytes,
    content_type: str = "image/jpeg",
) -> Tuple[str, Optional[str]]:
    """
    Use Gemini vision to read ingredient text from a label image (when OCR is weak).
    content_type is informational; bytes are re-encoded to JPEG for the API.
    """
    _ = content_type
    if not image_bytes or not get_api_key():
        return "", None
    try:
        jpeg_bytes, mime = _resize_image_for_gemini_vision(image_bytes)
    except Exception as e:
        return "", f"image decode failed: {e}"
    b64 = base64.standard_b64encode(jpeg_bytes).decode("ascii")
    parts = [{"text": _LABEL_VISION_PROMPT}, _normalize_inline_image_part(mime, b64)]
    return await gemini_generate_from_parts(
        parts,
        max_output_tokens=2048,
        temperature=0.15,
    )


def label_vision_enabled() -> bool:
    """Set GEMINI_LABEL_VISION=0 to skip Gemini vision fallback (OCR only)."""
    v = os.getenv("GEMINI_LABEL_VISION", "1").strip().lower()
    return v not in ("0", "false", "no", "off")


async def extract_allergen(description: str):
    if not get_api_key():
        words = description.lower().split()
        name = " ".join(words[:2]).capitalize() if words else "Custom Allergen"
        return {
            "allergen_name": name,
            "keywords": words[:3],
            "severity": "high",
            "symptoms": "User defined",
        }

    prompt = f"""Extract allergen info from:
    "{description}"

    Return JSON only:
    {{
      "allergen_name": "",
      "keywords": [],
      "severity": "",
      "symptoms": ""
    }}
    """

    text, err = await gemini_generate_text(prompt, max_output_tokens=512)
    if text:
        try:
            cleaned = text.strip().replace("```json", "").replace("```", "")
            return json.loads(cleaned)
        except json.JSONDecodeError:
            print("extract_allergen JSON parse:", err, text[:200])

    words = description.lower().split()
    name = " ".join(words[:2]).capitalize() if words else "Custom Allergen"
    return {
        "allergen_name": name,
        "keywords": words[:3],
        "severity": "high",
        "symptoms": "User defined",
    }


async def generate_summary(
    ingredients,
    allergens_found,
    health_concerns,
    diet_conflicts,
    score,
    user_profile,
    product_name: str = "",
    override: bool = True,
):
    if not get_api_key():
        return (
            "Add GEMINI_API_KEY (or GOOGLE_API_KEY) to backend/.env or the project root .env, "
            "then restart the API server."
        )

    prompt = f"""You are a careful food-safety educator. The user wants to know how safe these ingredients are for everyday consumption (general audience, not personal medical advice).

Product name: {product_name or "Unknown"}
Ingredients extracted by the app (may be incomplete if the photo was blurry): {ingredients}
App heuristic score 0-100 (higher = fewer rule-based red flags): {score}

User profile for extra context (not a diagnosis):
- Allergens they want to avoid: {user_profile.get("allergens", [])}
- Diets: {user_profile.get("diets", [])}

Rule-based flags from the app (use as hints, not exhaustive):
- Possible allergens: {allergens_found}
- Additives / processing / health notes: {health_concerns}
- Diet conflicts: {diet_conflicts}

Answer in plain text (no markdown), under 130 words:
1) Two or three sentences on general consumption safety: highly processed vs simpler foods, common additives, sugar/salt/fats if relevant, and what "moderation" might mean here.
2) One sentence on anything especially important for THIS user's listed allergens or diets.
3) One short disclaimer that this is educational only and not a substitute for a doctor or dietitian.

Use cautious wording ("may", "often", "consider"). Do not claim certainty about disease or allergies."""

    text, err = await gemini_generate_text(prompt, max_output_tokens=768)
    if text:
        return text

    return (
        f"Gemini summary failed: {err or 'unknown error'}. "
        "Confirm the key is a valid Google AI Studio API key and billing/quota allows generateContent. "
        "Heuristic score and flags above are still valid."
    )


async def generate_meal_plan(profile: Any, extra_notes: str = "") -> dict:
    """Return dict with keys: ok, text, days (parsed list or empty), error."""
    if not get_api_key():
        return {
            "ok": False,
            "text": "",
            "days": [],
            "error": "Missing GEMINI_API_KEY or GOOGLE_API_KEY in .env",
        }

    if hasattr(profile, "model_dump"):
        p = profile.model_dump()
    else:
        p = dict(profile)

    notes = (extra_notes or "").strip()
    prompt = f"""You are a registered-dietitian-style meal planning assistant.

User health profile (strictly avoid any listed allergens / conflicts):
- Allergens: {p.get("allergens", [])}
- Diets: {p.get("diets", [])}
- Health / additive flags to limit: {p.get("avoid_flags", [])}
- Custom ingredient terms to avoid: {p.get("custom_terms", [])}
- Extra user notes: {notes or "none"}

Create a 7-day meal plan that respects ALL restrictions. Keep meals practical and varied.

Return ONLY valid JSON (no markdown fences), exactly in this shape:
{{
  "days": [
    {{
      "day": "Monday",
      "breakfast": "short description",
      "lunch": "short description",
      "dinner": "short description",
      "snack": "optional"
    }}
  ],
  "shopping_tips": "one short paragraph"
}}
Include all 7 weekdays in order."""

    text, err = await gemini_generate_text(prompt, max_output_tokens=4096)
    if not text:
        return {"ok": False, "text": "", "days": [], "error": err or "empty response"}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned)

    try:
        data = json.loads(cleaned)
        days = data.get("days") if isinstance(data, dict) else None
        tips = data.get("shopping_tips", "") if isinstance(data, dict) else ""
        if isinstance(days, list) and days:
            return {
                "ok": True,
                "text": text,
                "days": days,
                "shopping_tips": tips,
                "error": None,
            }
    except json.JSONDecodeError:
        pass

    return {
        "ok": True,
        "text": text,
        "days": [],
        "shopping_tips": "",
        "error": None,
        "raw": True,
    }
