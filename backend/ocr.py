"""Extract raw text from product label images using Tesseract (local, no API key)."""
import io
import os
from typing import List

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pytesseract

# Downscale very large photos (speed); upscale small ones (tiny text on phone photos).
MAX_EDGE = 2800
MIN_EDGE = 1400

# Tesseract page segmentation modes to try (labels often = dense blocks or sparse lines).
_OCR_CONFIGS = (
    "--oem 3 --psm 6",  # uniform block (common for ingredient paragraphs)
    "--oem 3 --psm 3",  # fully automatic
    "--oem 3 --psm 11",  # sparse text / find as much as possible
    "--oem 3 --psm 4",  # single column
    "--oem 3 --psm 12",  # sparse + OSD
)


def _score_ocr_candidate(text: str) -> tuple:
    """Prefer transcripts that look like ingredient lists."""
    s = (text or "").strip()
    if not s:
        return (0, 0, 0, 0)
    lower = s.lower()
    ing = 2 if "ingredient" in lower else (1 if "contains" in lower else 0)
    commas = s.count(",")
    lines = len([ln for ln in s.splitlines() if ln.strip()])
    return (ing, commas, lines, len(s))


def _prepare_images(img: Image.Image) -> List[Image.Image]:
    """Return a few preprocessed variants for multi-pass OCR."""
    if img.mode in ("RGB", "L"):
        rgb = img.copy()
    else:
        rgb = img.convert("RGB")
    w, h = rgb.size
    long_side = max(w, h)

    if long_side < MIN_EDGE:
        scale = MIN_EDGE / long_side
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        rgb = rgb.resize((nw, nh), Image.Resampling.LANCZOS)
    elif long_side > MAX_EDGE:
        rgb.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)

    gray = ImageOps.grayscale(rgb)
    autocontrast = ImageOps.autocontrast(gray, cutoff=2)
    boosted = ImageEnhance.Contrast(
        autocontrast.filter(ImageFilter.SHARPEN),
    ).enhance(1.4)
    # Mild binarization helps some labels
    bw = autocontrast.point(lambda p: 255 if p > 165 else 0, mode="1").convert("L")

    seen: set[int] = set()
    out: List[Image.Image] = []
    for variant in (boosted, autocontrast, gray, bw):
        key = id(variant)
        if key not in seen:
            seen.add(key)
            out.append(variant)
    return out


def _run_tesseract_variants(images: List[Image.Image]) -> str:
    best = ""
    best_key = (0, 0, 0, 0)
    for prep in images:
        for cfg in _OCR_CONFIGS:
            try:
                chunk = pytesseract.image_to_string(prep, config=cfg) or ""
            except Exception:
                continue
            chunk = chunk.strip()
            if not chunk:
                continue
            key = _score_ocr_candidate(chunk)
            if key > best_key:
                best_key = key
                best = chunk
    return best


def image_to_text(image_bytes: bytes) -> str:
    if not image_bytes:
        return ""
    try:
        cmd = os.getenv("TESSERACT_CMD")
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        img = Image.open(io.BytesIO(image_bytes))
        variants = _prepare_images(img)
        text = _run_tesseract_variants(variants)
        return text.strip()
    except Exception as e:
        print("OCR error:", e)
        return ""
