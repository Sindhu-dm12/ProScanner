from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
import database, models, schemas, auth, analyzer, llm
import json
import jwt
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ingredients = analyzer.parse_ingredients(text)

    return await process_scan(ingredients, db, current_user)


@app.post("/scan/image")
async def scan_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    contents = await file.read()

    extraction = await llm.extract_from_image(contents)

    return await process_scan(
        extraction.get("ingredients", []),
        db,
        current_user
    )


# ================= CORE LOGIC =================

async def process_scan(ingredients, db, current_user):
    profile = db.query(models.Profile).filter(
        models.Profile.user_id == current_user.user_id
    ).first()

    user_allergens = json.loads(profile.allergens or "[]")
    user_diets = json.loads(profile.diets or "[]")
    user_flags = json.loads(profile.avoid_flags or "[]")

    custom_allergens = db.query(models.CustomAllergen).filter(
        models.CustomAllergen.user_id == current_user.user_id
    ).all()

    result = analyzer.analyze_ingredients(
        ingredients,
        user_allergens,
        user_diets,
        user_flags,
        custom_allergens
    )

    summary = await llm.generate_summary(
        ingredients=result["ingredients"],
        allergens_found=result["allergens_found"],
        health_concerns=result["health_concerns"],
        diet_conflicts=result["diet_conflicts"],
        score=result["score"],
        user_profile={
            "allergens": user_allergens,
            "diets": user_diets
        }
    )

    result["summary"] = summary

    history = models.ScanHistory(
        user_id=current_user.user_id,
        product_name="Scanned",
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
            "score": d.score,
            "data": json.loads(d.result_json)
        }
        for d in data
    ]