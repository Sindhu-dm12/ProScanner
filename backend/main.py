from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
import database, models, schemas, auth, analyzer, llm
import json
from uuid import uuid4

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

database.Base.metadata.create_all(bind=database.engine)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        import jwt
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

@app.post("/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    uid = str(uuid4())
    pw_hash = auth.hash_password(user.password)
    
    new_user = models.User(user_id=uid, email=user.email, name=user.name, password_hash=pw_hash)
    db.add(new_user)
    
    new_prof = models.Profile(user_id=uid, allergens="[]", diets="[]", avoid_flags="[]")
    db.add(new_prof)
    db.commit()
    return {"message": "Success"}

@app.post("/auth/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == username).first()
    if not user or not auth.verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = auth.create_access_token(data={"sub": user.user_id})
    return {"access_token": token, "token_type": "bearer", "user_id": user.user_id}

@app.get("/allergens")
def get_allergens():
    with open("allergens.json", "r") as f:
        return json.load(f)

@app.get("/profile/{user_id}")
def get_profile(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()
    return {
        "allergens": json.loads(p.allergens),
        "diets": json.loads(p.diets),
        "avoid_flags": json.loads(p.avoid_flags)
    }

@app.put("/profile/{user_id}")
def update_profile(user_id: str, p_update: schemas.ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()
    p.allergens = json.dumps(p_update.allergens)
    p.diets = json.dumps(p_update.diets)
    p.avoid_flags = json.dumps(p_update.avoid_flags)
    db.commit()
    return {"message": "OK"}

@app.post("/profile/add-allergen")
async def add_custom_allergen(body: schemas.AddCustomAllergen, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    data = await llm.extract_allergen(body.description)
    name = data.get("allergen_name", "Unknown")
    
    # Avoid duplicates in CustomAllergen table
    existing = db.query(models.CustomAllergen).filter(models.CustomAllergen.user_id == current_user.user_id, models.CustomAllergen.allergen_name == name).first()
    if not existing:
        ca = models.CustomAllergen(
            user_id=current_user.user_id,
            allergen_name=name,
            keywords=json.dumps(data.get("keywords", [])),
            severity=data.get("severity", "high")
        )
        db.add(ca)
    
    # Sync with Profile record
    p = db.query(models.Profile).filter(models.Profile.user_id == current_user.user_id).first()
    if p:
        current_allergens = json.loads(p.allergens) if p.allergens else []
        if name not in current_allergens:
            current_allergens.append(name)
            p.allergens = json.dumps(current_allergens)
            
    db.commit()
    return {"message": "Added", "allergen_name": name}

@app.delete("/profile/allergen/{allergen_name}")
def delete_custom_allergen(allergen_name: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Remove from CustomAllergen table
    cas = db.query(models.CustomAllergen).filter(models.CustomAllergen.user_id == current_user.user_id, models.CustomAllergen.allergen_name == allergen_name).all()
    for ca in cas:
        db.delete(ca)
    
    # Remove from Profile record
    p = db.query(models.Profile).filter(models.Profile.user_id == current_user.user_id).first()
    if p:
        current_allergens = json.loads(p.allergens) if p.allergens else []
        if allergen_name in current_allergens:
            current_allergens = [a for a in current_allergens if a != allergen_name]
            p.allergens = json.dumps(current_allergens)
            
    db.commit()
    return {"message": "Deleted"}


@app.post("/scan/image")
async def scan_image(file: UploadFile = File(...), product_name: str = Form("Scanned Product"), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    contents = await file.read()
    extraction = await llm.extract_from_image(contents)
    return await process_scan(
        extraction.get("ingredients", []), 
        db, 
        current_user, 
        extraction.get("nutrition_facts", {}), 
        product_name,
        extraction.get("extraction_confidence", 85)
    )

@app.post("/scan/text")
async def scan_text(text: str = Form(...), product_name: str = Form("Scanned Product"), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    ingredients = analyzer.parse_ingredients(text)
    return await process_scan(ingredients, db, current_user, {}, product_name, 100)

async def process_scan(ingredients: list[str], db: Session, current_user: models.User, nutrition_facts: dict = None, product_name: str = "Scanned Product", confidence: int = 100):
    if nutrition_facts is None: nutrition_facts = {}
        
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.user_id).first()
    user_allergens = json.loads(profile.allergens) if profile.allergens else []
    user_diets = json.loads(profile.diets) if profile.diets else []
    user_flags = json.loads(profile.avoid_flags) if profile.avoid_flags else []
    
    # 1. ATTEMPT CACHE RETRIEVAL
    # Search for an identical scan (same profile settings + same ingredients)
    ingredients_str = ",".join(sorted(ingredients))
    cache_objs = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == current_user.user_id).order_by(models.ScanHistory.id.desc()).limit(10).all()
    
    for obj in cache_objs:
        data = json.loads(obj.result_json)
        if ",".join(sorted(data.get("ingredients", []))) == ingredients_str:
            # Check if profile was the same at that time
            # Note: We don't store profile history, but we can assume if the user is scanning again
            # and the result data looks identical to current profile settings, we can reuse it.
            # But wait, it's safer to just check if we need to regenerate the summary.
            pass

    # 2. RUN ANALYSIS
    custom_allergens = db.query(models.CustomAllergen).filter(models.CustomAllergen.user_id == current_user.user_id).all()
    
    result = analyzer.analyze_ingredients(
        ingredients=ingredients,
        user_allergens=user_allergens,
        user_diets=user_diets,
        user_flags=user_flags,
        custom_allergens=custom_allergens
    )
    
    result["accuracy"] = round((confidence + result.get("extraction_accuracy", 100)) / 2, 1)
    result["nutrition_facts"] = nutrition_facts
    
    # 3. SUMMARY CACHE / GENERATION
    profile_dict = {"allergens": user_allergens, "diets": user_diets, "avoid_flags": user_flags}
    
    # Check if we have a summary for THIS result in history already
    summary = None
    for obj in cache_objs:
        data = json.loads(obj.result_json)
        # If ingredients and findings match, reuse summary
        if (sorted(data.get("ingredients", [])) == sorted(ingredients) and 
            data.get("allergens_found") == result["allergens_found"] and
            data.get("diet_conflicts") == result["diet_conflicts"]):
            summary = data.get("summary")
            if summary:
                print("Reusing cached summary to save AI quota.")
                break
                
    if not summary:
        summary = await llm.generate_summary(
            ingredients=result["ingredients"],
            allergens_found=result["allergens_found"],
            health_concerns=result["health_concerns"],
            diet_conflicts=result["diet_conflicts"],
            score=result["score"],
            user_profile=profile_dict
        )
    
    result["summary"] = summary
    
    history = models.ScanHistory(
        user_id=current_user.user_id,
        product_name=product_name,
        score=result["score"],
        result_json=json.dumps(result)
    )
    db.add(history)

    db.commit()
    db.refresh(history)
    
    result["history_id"] = history.id
    return result

@app.get("/history/{user_id}")
def get_history(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    objs = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == user_id).order_by(models.ScanHistory.id.desc()).all()
    return [{"id": o.id, "product_name": o.product_name, "score": o.score, "data": json.loads(o.result_json)} for o in objs]

@app.delete("/history/{history_id}")
def delete_history_item(history_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    h = db.query(models.ScanHistory).filter(models.ScanHistory.id == history_id, models.ScanHistory.user_id == current_user.user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(h)
    db.commit()
    return {"message": "Deleted"}

@app.get("/stats/{user_id}")
def get_stats(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    objs = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == user_id).all()
    total_scans = len(objs)
    avg_score = sum([o.score for o in objs]) / total_scans if total_scans > 0 else 0
    safe_scans = len([o for o in objs if o.score > 80])
    return {
        "total_scans": total_scans,
        "avg_score": round(avg_score, 1),
        "safe_scans": safe_scans
    }
