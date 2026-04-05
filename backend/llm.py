import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai

# Load repo root .env then backend/.env (backend wins for overrides)
_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_BACKEND_DIR / ".env", override=True)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()

_client = None


def get_client():
    global _client
    key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key:
        return None
    if _client is None:
        _client = genai.Client(api_key=key)
    return _client


def _models_to_try() -> list[str]:
    if GEMINI_MODEL:
        return [GEMINI_MODEL]
    return [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
    ]


def _response_text(response) -> str:
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


async def extract_allergen(description: str):
    client = get_client()
    if not client:
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

    Return JSON:
    {{
      "allergen_name": "",
      "keywords": [],
      "severity": "",
      "symptoms": ""
    }}
    """

    for model in _models_to_try():
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
            )
            text = _response_text(response).replace("```json", "").replace("```", "")
            if text:
                return json.loads(text)
        except Exception as e:
            print(f"extract_allergen ({model}):", e)

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
    client = get_client()
    if not client:
        return (
            "Add GEMINI_API_KEY or GOOGLE_API_KEY to backend/.env or the project root .env file. "
            "Restart the server after saving. Heuristic scores and flags still work without AI."
        )

    prompt = f"""You are a concise nutrition assistant for a food label scanner.

Product: {product_name or "Unknown"}
Parsed ingredients (lowercase tokens): {ingredients}
Safety score (0-100, higher is better): {score}
User allergens to watch: {user_profile.get("allergens", [])}
User diets: {user_profile.get("diets", [])}

Flagged allergens (from rules): {allergens_found}
Health / additive concerns: {health_concerns}
Diet conflicts: {diet_conflicts}

Write 2-4 short sentences: overall verdict, key risks for THIS user if any, and one practical tip. Under 100 words. Plain text only, no markdown."""

    last_error = None
    for model in _models_to_try():
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
            )
            text = _response_text(response)
            if text:
                return text
            last_error = "empty response"
        except Exception as e:
            last_error = str(e)
            print(f"generate_summary ({model}):", e)

    return (
        f"AI summary unavailable ({last_error or 'unknown'}). "
        "Check your API key and model access in Google AI Studio. "
        "Scores and ingredient flags above are still valid."
    )
