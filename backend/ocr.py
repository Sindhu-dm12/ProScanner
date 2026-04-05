"""Extract raw text from product label images using Tesseract (local, no API key)."""
import io
import os

from PIL import Image
import pytesseract

MAX_EDGE = 2000


def image_to_text(image_bytes: bytes) -> str:
    if not image_bytes:
        return ""
    try:
        cmd = os.getenv("TESSERACT_CMD")
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > MAX_EDGE:
            img.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        return (pytesseract.image_to_string(img) or "").strip()
    except Exception as e:
        print("OCR error:", e)
        return ""
