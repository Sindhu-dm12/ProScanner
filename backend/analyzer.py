import json
import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(BASE_DIR, "allergens.json")

with open(file_path, "r") as f:
    ALLERGEN_DB = json.load(f)

def parse_ingredients(text: str) -> list[str]:
    text = text.replace('\n', ' ')
    match = re.search(r'ingredients:?\s*(.*)', text, re.IGNORECASE)
    if match:
        text = match.group(1)
        
    items = [x.strip().lower() for x in re.split(r'[,.\n;]', text)]
    return [x for x in items if len(x) > 2]

def analyze_ingredients(ingredients: list[str], user_allergens: list[str], user_diets: list[str], user_flags: list[str], custom_allergens: list) -> dict:
    allergens_found = []
    diet_conflicts = []
    health_concerns = []
    
    if not ingredients:
        return {
            "score": 0,
            "allergens_found": [],
            "health_concerns": [],
            "diet_conflicts": [],
            "ingredients": [],
            "error": "No ingredients detected. Please try a clearer photo.",
            "extraction_accuracy": 0
        }

    score = 100
    
    # Check custom allergens
    for ca in custom_allergens:
        keywords = json.loads(ca.keywords) if isinstance(ca.keywords, str) else ca.keywords
        for kw in keywords:
            if any(kw.lower() in ing.lower() for ing in ingredients):
                allergens_found.append({
                    "label": ca.allergen_name,
                    "severity": ca.severity,
                    "description": "Custom user allergen"
                })
                score -= 30
                break

    # Check DB allergens
    for ua in user_allergens:
        if ua in ALLERGEN_DB["allergens"]:
            db_entry = ALLERGEN_DB["allergens"][ua]
            for kw in db_entry["keywords"]:
                if any(kw.lower() in ing.lower() for ing in ingredients):
                    allergens_found.append({**db_entry, "matched_keyword": kw})
                    score -= 40
                    break
                    
    # GLOBAL Health Checks
    global_health_flags = ["high_sugar", "trans_fats", "artificial_colors", "artificial_sweeteners"]
    for g_flag in global_health_flags:
        if g_flag in ALLERGEN_DB["health_flags"]:
            db_entry = ALLERGEN_DB["health_flags"][g_flag]
            # Always check global flags
            for kw in db_entry["keywords"]:
                if any(kw.lower() in ing.lower() for ing in ingredients):
                    health_concerns.append({**db_entry, "matched_keyword": kw, "global": True})
                    score -= 15  # Increased penalty for global health flags
                    break
                        
    # Check User Health flags
    for uf in user_flags:
        if uf in ALLERGEN_DB["health_flags"]:
            db_entry = ALLERGEN_DB["health_flags"][uf]
            for kw in db_entry["keywords"]:
                if any(kw.lower() in ing.lower() for ing in ingredients):
                    health_concerns.append({**db_entry, "matched_keyword": kw})
                    score -= 10
                    break
                    
    # Check Diets
    for ud in user_diets:
        if ud in ALLERGEN_DB["diet_conflicts"]:
            db_entry = ALLERGEN_DB["diet_conflicts"][ud]
            for kw in db_entry["keywords"]:
                if any(kw.lower() in ing.lower() for ing in ingredients):
                    diet_conflicts.append({**db_entry, "matched_keyword": kw})
                    score -= 20
                    break
                    
    return {
        "score": max(0, score),
        "allergens_found": allergens_found,
        "health_concerns": health_concerns,
        "diet_conflicts": diet_conflicts,
        "ingredients": ingredients,
        "extraction_accuracy": min(100, 40 + len(ingredients) * 10)  # Better heuristic: baseline + per-item
    }
