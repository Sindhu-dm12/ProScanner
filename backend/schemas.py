from pydantic import BaseModel
from typing import List, Optional

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class ProfileUpdate(BaseModel):
    allergens: List[str]
    diets: List[str]
    avoid_flags: List[str]

class AddCustomAllergen(BaseModel):
    description: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
