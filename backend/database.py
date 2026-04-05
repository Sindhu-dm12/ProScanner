from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent
_root = _backend.parent
load_dotenv(_root / ".env")
load_dotenv(_backend / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scanner.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
