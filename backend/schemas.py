from pydantic import BaseModel, Field
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


class MVPProfile(BaseModel):
    allergens: List[str] = Field(default_factory=list)
    diets: List[str] = Field(default_factory=list)
    avoid_flags: List[str] = Field(default_factory=list)
    custom_terms: List[str] = Field(default_factory=list)


class MVPScanText(BaseModel):
    text: str
    product_name: str = "Scanned Product"
    profile: MVPProfile = Field(default_factory=MVPProfile)
