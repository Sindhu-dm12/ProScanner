import google.generativeai as genai
import json
import os
from dotenv import load_dotenv
import PIL.Image
import io

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY", "AIzaSyAC28h1cuYlc-oL_JLeHSvYyHo5WOyugJM"))
model = genai.GenerativeModel('gemini-1.5-flash')


async def extract_allergen(description: str):
    prompt = f'''Extract allergen information from this description:
    "{description}"
    
    Return JSON with:
    - allergen_name (string)
    - keywords (array of strings for matching)
    - severity (high/medium/low)
    - symptoms (string)
    
    Only JSON, no explanation.'''
    
    try:
        response = await model.generate_content_async(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"AI Allergen Extraction failed: {e}. Using heuristic fallback.")
        # HEURISTIC FALLBACK:
        # Simple extraction for common phrases like "I am allergic to X"
        clean_desc = description.lower().replace("i am", "").replace("i'm", "").replace("allergic to", "").replace("i have an allergy to", "").strip()
        # Take the first 1-2 words as the allergen name
        words = clean_desc.split()
        name = " ".join(words[:2]).capitalize() if words else "Custom Allergen"
        
        return {
            "allergen_name": name, 
            "keywords": [name.lower()] + ([w.lower() for w in words[:3]] if words else []),
            "severity": "high", 
            "symptoms": "User defined"
        }


async def extract_from_image(image_bytes: bytes):
    try:
        image = PIL.Image.open(io.BytesIO(image_bytes))
        prompt = '''Extract the full ingredients list and any available nutrition facts from this product label or derive nutrition facts from the ingredients.
        Return ONLY a JSON response exactly in this format:
        {
          "ingredients": ["list", "of", "ingredients", "lowercase", "stripped of percentages"],
          "nutrition_facts": {
            "calories": "value",
            "total_fat": "value",
            "sugar": "value"
          },
          "extraction_confidence": 0-100
        }
        Only output pure JSON. No markdown code blocks, just raw JSON text.'''
        
        print(f"Calling Gemini with image size: {len(image_bytes)} bytes")
        response = await model.generate_content_async([prompt, image])
        print("Gemini response received.")
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
             text = text.split("```")[1].split("```")[0].strip()
             
        data = json.loads(text)
        return {
            "ingredients": data.get("ingredients", []), 
            "nutrition_facts": data.get("nutrition_facts", {}),
            "extraction_confidence": data.get("extraction_confidence", 85)
        }
    except Exception as e:
        import traceback
        print("Error parsing Gemini image response: ", e)
        print(traceback.format_exc())
        return {"ingredients": [], "nutrition_facts": {}, "extraction_confidence": 0}

async def generate_summary(
    ingredients: list[str],
    allergens_found: list[dict],
    health_concerns: list[dict],
    diet_conflicts: list[dict],
    score: int,
    user_profile: dict
):
    prompt = f'''You are a health-conscious nutritionist. Analyze this product:

Ingredients: {", ".join(ingredients[:30])}
Safety Score: {score}/100

User's allergies: {", ".join(user_profile.get('allergens', []))}
User's diets: {", ".join(user_profile.get('diets', []))}

Issues found:
- Allergens: {", ".join(a['label'] for a in allergens_found)}
- Diet conflicts: {", ".join(d['label'] for d in diet_conflicts)}
- Health concerns: {", ".join(h['label'] for h in health_concerns)}

Write a 3-4 sentence summary:
1. Lead with the most critical issue (allergen > diet > health)
2. Be specific about which ingredients are problematic
3. End with one actionable recommendation

Keep it under 100 words. Be direct and helpful.'''

    try:
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        import traceback
        print("Error generating Gemini summary: ", e)
        # PROFESSIONAL HEURISTIC FALLBACK (Infinite Free Tier)
        # Construct a smart, structured summary based on findings
        
        all_issues = []
        if allergens_found:
            all_issues.append(f"contains {', '.join(a['label'] for a in allergens_found[:3])}, which matches your reported allergens")
        if diet_conflicts:
            all_issues.append(f"conflicts with your {diet_conflicts[0]['label']} restriction due to ingredients like {diet_conflicts[0].get('matched_keyword', 'certain additives')}")
        if health_concerns:
            # Separate global flags from user-defined ones for better phrasing
            global_flags = [h for h in health_concerns if h.get("global")]
            user_flags = [h for h in health_concerns if not h.get("global")]
            
            if global_flags:
                all_issues.append(f"contains high-concern additives like {global_flags[0]['label']}")
            if user_flags:
                all_issues.append(f"includes {user_flags[0]['label']}, which you've chosen to avoid")

        if not all_issues:
            summary = "This product appears to be a safe choice based on your current profile. "
            summary += f"The ingredients list (including {', '.join(ingredients[:3])}) contains no known triggers or conflicts. "
            summary += "You can enjoy this product with confidence."
        else:
            # Lead with the most important issue (Allergen)
            lead = f"WARNING: This product {all_issues[0]}. "
            if len(all_issues) > 1:
                lead += f"Additionally, it {all_issues[1]}. "
            
            recommendation = "We recommend looking for a safer alternative that fits your dietary needs." if score < 60 else "Consume with caution after verifying specific ingredients."
            summary = f"{lead} {recommendation}"

        return summary + " (Safe Scanner Pro)"

