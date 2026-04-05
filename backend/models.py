from sqlalchemy import Column, Integer, String, JSON
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    name = Column(String)

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    allergens = Column(String)
    diets = Column(String)
    avoid_flags = Column(String)

class ScanHistory(Base):
    __tablename__ = "scan_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    product_name = Column(String)
    score = Column(Integer)
    result_json = Column(String)

class CustomAllergen(Base):
    __tablename__ = "custom_allergens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    allergen_name = Column(String)
    keywords = Column(String)
    severity = Column(String)
