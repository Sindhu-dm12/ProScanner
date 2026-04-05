from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from pathlib import Path
import os
import jwt
import re

_backend_dir = Path(__file__).resolve().parent
_repo_root = _backend_dir.parent
load_dotenv(_repo_root / ".env")
load_dotenv(_backend_dir / ".env", override=True)

import database, models, schemas, auth, analyzer, llm, ocr
import json
import hashlib
from sqlalchemy import desc
from datetime import datetime
from PIL import Image
import io
from uuid import uuid4

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB
database.Base.metadata.create_all(bind=database.engine)

# AUTH
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

# DB DEPENDENCY
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ================= AUTH =================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(models.User).filter(models.User.user_id == user_id).first()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except Exception as e:
        print("AUTH ERROR:", e)
        raise HTTPException(status_code=401, detail="Auth failed")


# ================= AUTH ROUTES =================

@app.post("/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    uid = str(uuid4())
    pw_hash = auth.hash_password(user.password)

    new_user = models.User(
        user_id=uid,
        email=user.email,
        name=user.name,
        password_hash=pw_hash
    )
    db.add(new_user)

    profile = models.Profile(
        user_id=uid,
        allergens="[]",
        diets="[]",
        avoid_flags="[]"
    )
    db.add(profile)

    db.commit()

    return {"message": "Registered"}


@app.post("/auth/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == username).first()

    if not user or not auth.verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = auth.create_access_token({"user_id": user.user_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.user_id
    }


# ================= ALLERGENS =================

@app.get("/allergens")
def get_allergens():
    try:
        with open("backend/allergens.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        # Fallback to local path if running from backend dir
        with open("allergens.json", "r") as f:
            return json.load(f)

# ================= PROFILE =================

@app.get("/profile/{user_id}")
def get_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    p = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()

    if not p:
        return {"allergens": [], "diets": [], "avoid_flags": []}

    return {
        "allergens": json.loads(p.allergens or "[]"),
        "diets": json.loads(p.diets or "[]"),
        "avoid_flags": json.loads(p.avoid_flags or "[]")
    }


@app.post("/profile/add-allergen")
async def add_custom_allergen(
    payload: schemas.AddCustomAllergen,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Use AI to extract structured info from the description
    data = await llm.extract_allergen(payload.description)
    
    new_ca = models.CustomAllergen(
        user_id=current_user.user_id,
        allergen_name=data["allergen_name"],
        keywords=json.dumps(data["keywords"]),
        severity=data["severity"]
    )
    db.add(new_ca)
    db.commit()
    
    return data


@app.delete("/profile/allergen/{name}")
def delete_custom_allergen(
    name: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.CustomAllergen).filter(
        models.CustomAllergen.user_id == current_user.user_id,
        models.CustomAllergen.allergen_name == name
    ).delete()
    db.commit()
    return {"message": "Deleted"}


@app.put("/profile/{user_id}")
def update_profile(
    user_id: str,
    p_update: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    p = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()

    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")

    p.allergens = json.dumps(p_update.allergens)
    p.diets = json.dumps(p_update.diets)
    p.avoid_flags = json.dumps(p_update.avoid_flags)

    db.commit()

    return {"message": "Updated"}


# ================= SCAN =================

@app.post("/scan/text")
async def scan_text(
    text: str = Form(...),
    product_name: str = Form("Scanned Product"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ingredients = analyzer.parse_ingredients(text)

    return await process_scan(ingredients, product_name, db, current_user)


@app.post("/scan/image")
async def scan_image(
    file: UploadFile = File(...),
    product_name: str = Form("Scanned Product"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    contents = await file.read()
    raw_text = ocr.image_to_text(contents)
    ingredients = analyzer.parse_ingredients(raw_text)
    if not ingredients and raw_text:
        items = [x.strip().lower() for x in re.split(r"[,.\n;]", raw_text) if len(x.strip()) > 2]
        ingredients = items

    return await process_scan(ingredients, product_name, db, current_user)


# ================= CORE LOGIC =================

async def process_scan(ingredients, product_name, db, current_user):
    profile = db.query(models.Profile).filter(
        models.Profile.user_id == current_user.user_id
    ).first()

    user_allergens = json.loads(profile.allergens or "[]")
    user_diets = json.loads(profile.diets or "[]")
    user_flags = json.loads(profile.avoid_flags or "[]")
    custom_allergens = (
        db.query(models.CustomAllergen)
        .filter(models.CustomAllergen.user_id == current_user.user_id)
        .all()
    )
    # --- CACHING LOGIC ---
    ingredients_str = ",".join(sorted([i.strip() for i in ingredients]))
    ingredients_hash = hashlib.sha256(ingredients_str.encode()).hexdigest()
    
    # Check cache
    cached = db.query(models.ScanCache).filter(models.ScanCache.ingredients_hash == ingredients_hash).first()
    if cached:
        print(f"DEBUG: Cache hit for {product_name}")
        result = json.loads(cached.result_json)
        # Update product name if changed
        result["product_name"] = product_name
    else:
        print(f"DEBUG: Cache miss for {product_name}, calling AI...")
        result = {
            "score": 0,
            "product_name": product_name,
            "allergens_found": [],
            "health_concerns": [],
            "diet_conflicts": [],
            "ingredients": ingredients,
            "extraction_accuracy": 80
        }

        # 1. Basic Analysis (Heuristics)
        analysis = analyzer.analyze_ingredients(
            ingredients, user_allergens, user_diets, user_flags, custom_allergens
        )
        result.update(analysis)

        # 2. AI Summary
        summary = await llm.generate_summary(
            ingredients=ingredients,
            allergens_found=result["allergens_found"],
            health_concerns=result["health_concerns"],
            diet_conflicts=result["diet_conflicts"],
            score=result["score"],
            user_profile={"allergens": user_allergens, "diets": user_diets},
            product_name=product_name,
            override=True,
        )
        result["summary"] = summary

        # Save to cache
        new_cache = models.ScanCache(
            ingredients_hash=ingredients_hash,
            result_json=json.dumps(result)
        )
        db.add(new_cache)
        db.commit()

    # 3. Save to user history
    history = models.ScanHistory(
        user_id=current_user.user_id,
        product_name=product_name,
        score=result["score"],
        result_json=json.dumps(result)
    )
    db.add(history)
    db.commit()

    return result


# ================= HISTORY =================

@app.get("/history/{user_id}")
def get_history(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403)

    data = db.query(models.ScanHistory).filter(
        models.ScanHistory.user_id == user_id
    ).all()

    return [
        {
            "id": d.id,
            "product_name": d.product_name,
            "score": d.score,
            "data": json.loads(d.result_json)
        }
        for d in data
    ]


@app.delete("/history/{history_id}")
def delete_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.ScanHistory).filter(
        models.ScanHistory.id == history_id,
        models.ScanHistory.user_id == current_user.user_id
    ).delete()
    db.commit()
    return {"message": "Deleted"}


@app.get("/stats/{user_id}")
def get_stats(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403)

    data = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == user_id).all()
    
    if not data:
        return {"total_scans": 0, "safe_scans": 0, "avg_score": 0}

    scores = [d.score for d in data]
    safe_scans = len([d for d in data if d.score >= 80])

    return {
        "total_scans": len(data),
        "safe_scans": safe_scans,
        "avg_score": int(sum(scores) / len(scores))
    }


# ================= MVP (no auth; profile from client; Tesseract + Gemini summary) =================


async def mvp_process_scan(
    ingredients: list,
    product_name: str,
    profile: schemas.MVPProfile,
):
    p = profile
    analysis = analyzer.analyze_ingredients(
        ingredients,
        p.allergens,
        p.diets,
        p.avoid_flags,
        [],
    )
    result = {
        "score": analysis["score"],
        "product_name": product_name,
        "allergens_found": analysis["allergens_found"],
        "health_concerns": analysis["health_concerns"],
        "diet_conflicts": analysis["diet_conflicts"],
        "ingredients": analysis["ingredients"],
        "extraction_accuracy": analysis.get("extraction_accuracy", 0),
    }
    if analysis.get("error"):
        result["error"] = analysis["error"]

    # Custom watchlist (substring match on parsed ingredient tokens)
    for term in p.custom_terms:
        t = (term or "").strip().lower()
        if len(t) < 2:
            continue
        if any(t in ing for ing in result["ingredients"]):
            result["allergens_found"].append(
                {
                    "label": f"Custom watchlist: {term.strip()}",
                    "severity": "high",
                    "description": "Matched text from your custom list.",
                    "color": "red",
                }
            )
            result["score"] = max(0, result["score"] - 25)

    summary = await llm.generate_summary(
        ingredients=result["ingredients"],
        allergens_found=result["allergens_found"],
        health_concerns=result["health_concerns"],
        diet_conflicts=result["diet_conflicts"],
        score=result["score"],
        user_profile={"allergens": p.allergens, "diets": p.diets},
        product_name=product_name,
    )
    result["summary"] = summary

    return result


@app.post("/api/scan/text")
async def api_scan_text(body: schemas.MVPScanText):
    ingredients = analyzer.parse_ingredients(body.text)
    return await mvp_process_scan(ingredients, body.product_name, body.profile)


@app.post("/api/scan/image")
async def api_scan_image(
    file: UploadFile = File(...),
    product_name: str = Form("Scanned Product"),
    profile_json: str = Form("{}"),
):
    try:
        profile = schemas.MVPProfile.model_validate_json(profile_json)
    except Exception:
        profile = schemas.MVPProfile()

    contents = await file.read()
    raw_text = ocr.image_to_text(contents)
    ingredients = analyzer.parse_ingredients(raw_text)
    if not ingredients and raw_text:
        items = [x.strip().lower() for x in re.split(r"[,.\n;]", raw_text) if len(x.strip()) > 2]
        ingredients = items

    return await mvp_process_scan(ingredients, product_name, profile)