import json
import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(BASE_DIR, "allergens.json")

with open(file_path, "r") as f:
    ALLERGEN_DB = json.load(f)

# Map common UI labels to keys in allergens.json
ALLERGEN_KEY_ALIASES = {
    "peanut": "peanuts",
    "peanuts": "peanuts",
    "dairy": "dairy",
    "dairy / milk": "dairy",
    "gluten": "gluten",
    "gluten / wheat": "gluten",
    "soy": "soy",
    "nuts": "tree_nuts",
    "tree nuts": "tree_nuts",
    "tree_nuts": "tree_nuts",
    "egg": "eggs",
    "eggs": "eggs",
    "fish": "fish",
    "shellfish": "shellfish",
    "oats": "oats",
    "corn": "corn",
    "corn / maize": "corn",
    "rice": "rice",
    "beef": "beef",
    "beef / red meat": "beef",
    "pork": "pork",
    "mustard": "mustard",
    "celery": "celery",
    "lupin": "lupin",
    "sesame": "sesame",
    "sulfites": "sulfites",
    "sulfites / so2": "sulfites",
}

DIET_KEY_ALIASES = {
    "vegan": "vegan",
    "vegetarian": "vegetarian",
    "keto": "keto",
    "paleo": "paleo",
    "halal": "halal",
}


def _normalize_allergen_key(ua: str) -> str:
    raw = ua.strip()
    kl = raw.lower()
    if kl in ALLERGEN_KEY_ALIASES:
        return ALLERGEN_KEY_ALIASES[kl]
    k_us = kl.replace(" ", "_")
    if k_us in ALLERGEN_KEY_ALIASES:
        return ALLERGEN_KEY_ALIASES[k_us]
    return ALLERGEN_KEY_ALIASES.get(kl.replace("_", " "), k_us)


def _normalize_diet_key(ud: str) -> str:
    k = ud.strip().lower().replace(" ", "_")
    return DIET_KEY_ALIASES.get(k, k)


def parse_ingredients(text: str) -> list[str]:
    """
    Split label text into ingredient tokens.

    Many pastes include marketing copy where the substring \"ingredients\" appears
    (e.g. \"natural ingredients\" at the end) with nothing after it — the old regex
    then captured an empty tail and dropped the whole list. We only trust an
    \"Ingredients:\" section when it actually yields tokens; otherwise we parse the
    full text (comma / period / semicolon separated).
    """
    raw = (text or "").strip()
    if not raw:
        return []

    def tokens_from(blob: str) -> list[str]:
        blob = blob.replace("\n", " ")
        items = [x.strip().lower() for x in re.split(r"[,.\n;]", blob)]
        return [x for x in items if len(x) > 2]

    normalized = raw.replace("\n", " ")
    match = re.search(r"\bingredients:?\s*(.*)", normalized, re.IGNORECASE)
    if match:
        tail = (match.group(1) or "").strip()
        from_section = tokens_from(tail)
        if from_section:
            return from_section
    return tokens_from(normalized)

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
            "error": "No ingredients detected. Paste a comma-separated list or try a clearer label photo.",
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
        key = _normalize_allergen_key(ua)
        if key in ALLERGEN_DB["allergens"]:
            db_entry = ALLERGEN_DB["allergens"][key]
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
        key = _normalize_diet_key(ud)
        if key not in ALLERGEN_DB["diet_conflicts"]:
            continue
        db_entry = ALLERGEN_DB["diet_conflicts"][key]
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
