from google import genai
import json
import os
from dotenv import load_dotenv
import PIL.Image
import io

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# ✅ TEXT → ALLERGEN EXTRACTION
async def extract_allergen(description: str):
    prompt = f"""Extract allergen info from:
    "{description}"
    
    Return JSON:
    {{
      "allergen_name": "",
      "keywords": [],
      "severity": "",
      "symptoms": ""
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )

        text = response.text.strip().replace("```json", "").replace("```", "")
        return json.loads(text)

    except Exception as e:
        print("Fallback triggered:", e)

        words = description.lower().split()
        name = " ".join(words[:2]).capitalize() if words else "Custom Allergen"

        return {
            "allergen_name": name,
            "keywords": words[:3],
            "severity": "high",
            "symptoms": "User defined"
        }


# ✅ IMAGE → INGREDIENTS
async def extract_from_image(image_bytes: bytes):
    try:
        image = PIL.Image.open(io.BytesIO(image_bytes))

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[
                "Extract ingredients + nutrition as JSON",
                image
            ]
        )

        text = response.text.strip().replace("```json", "").replace("```", "")
        data = json.loads(text)

        return {
            "ingredients": data.get("ingredients", []),
            "nutrition_facts": data.get("nutrition_facts", {}),
            "extraction_confidence": data.get("extraction_confidence", 85)
        }

    except Exception as e:
        print("Image error:", e)
        return {"ingredients": [], "nutrition_facts": {}, "extraction_confidence": 0}


# ✅ SUMMARY
async def generate_summary(
    ingredients,
    allergens_found,
    health_concerns,
    diet_conflicts,
    score,
    user_profile
):
    prompt = f"""
    Ingredients: {ingredients}
    Score: {score}
    Allergens: {allergens_found}
    Health: {health_concerns}

    Give short summary under 80 words.
    """

    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        return response.text.strip()

    except Exception as e:
        print("Summary error:", e)
        return "Basic analysis complete. Review ingredients manually."