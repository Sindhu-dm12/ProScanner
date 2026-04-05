import json

def mock_analyzer_analyze(ingredients, user_allergens):
    # Simplified version for testing
    found = []
    if "peanuts" in ingredients and "peanuts" in user_allergens:
        found.append({"label": "Peanuts", "severity": "high"})
    return {"ingredients": ingredients, "allergens_found": found, "diet_conflicts": [], "score": 70 if not found else 30}

def get_heuristic_summary(ingredients, allergens_found, diet_conflicts, health_concerns, score):
    # Simplified version of the one in llm.py
    all_issues = []
    if allergens_found:
        all_issues.append(f"contains {', '.join(a['label'] for a in allergens_found[:3])}")
    if not all_issues:
        return "Safe choice. (Safe Scanner Pro)"
    return f"WARNING: {all_issues[0]}. (Safe Scanner Pro)"

def test_caching_logic():
    # Mock data
    ingredients = ["water", "sugar", "peanuts"]
    user_allergens = ["peanuts"]
    
    # First scan
    result1 = mock_analyzer_analyze(ingredients, user_allergens)
    summary1 = get_heuristic_summary(result1["ingredients"], result1["allergens_found"], [], [], result1["score"])
    result1["summary"] = summary1
    
    print(f"Scan 1 Summary: {summary1}")
    
    # Mock Scan History
    history = [{"result_json": json.dumps(result1)}]
    
    # Second scan - check cache
    result2 = mock_analyzer_analyze(ingredients, user_allergens)
    cached_summary = None
    for item in history:
        data = json.loads(item["result_json"])
        if (sorted(data.get("ingredients", [])) == sorted(ingredients) and 
            data.get("allergens_found") == result2["allergens_found"]):
            cached_summary = data.get("summary")
            break
            
    print(f"Scan 2 Cached Summary: {cached_summary}")
    assert cached_summary == summary1
    print("Success: Cache logic correctly identifies reusable summary.")

if __name__ == "__main__":
    test_caching_logic()
