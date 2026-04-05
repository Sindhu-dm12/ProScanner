"""
Load environment variables from .env files before any other backend module reads os.environ.

Order: repository root .env, then backend/.env (later file wins on duplicate keys).
Uses override=True so values from files replace empty placeholders in the process environment.
"""
from pathlib import Path

from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent
_root = _backend.parent

for _env_path in (_root / ".env", _backend / ".env"):
    if _env_path.is_file():
        load_dotenv(_env_path, override=True, encoding="utf-8-sig")
