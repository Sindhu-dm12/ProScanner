import json
import pandas as pd
import os

def load_forensic_data(json_path=None):
    if json_path is None:
        abs_path = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(abs_path, "../data/locations.json")

    with open(json_path) as f:
        data = json.load(f)
    return data

def process_persons(data):
    persons = pd.DataFrame(data["persons"])
    
    def person_to_text(row):
        return f"Person {row['name']} with phone {row['phone']} lives at {row['address']}. Email is {row['email']}. Risk score is {row['risk_score']}."

    persons["text"] = persons.apply(person_to_text, axis=1)
    return persons

def process_locations(data):
    if "locations" not in data:
        return pd.DataFrame()
    
    locations = pd.DataFrame(data["locations"])
    
    def location_to_text(row):
        return f"Person {row['person_id']} was at {row['location_name']} at time {row['timestamp']} using {row['source']}."

    locations["text"] = locations.apply(location_to_text, axis=1)
    return locations

if __name__ == "__main__":
    # ==============================
    # STEP 1: LOAD JSON FILE
    # ==============================
    data = load_forensic_data()
    print("✅ JSON Loaded Successfully")

    # ==============================
    # STEP 2: CHECK AVAILABLE DATA
    # ==============================
    print("\n📂 Available Keys in Dataset:")
    print(list(data.keys()))

    # ==============================
    # STEP 3 & 6: LOAD & PROCESS PERSONS
    # ==============================
    persons = process_persons(data)
    print("\n👤 Persons Data (with AI-ready text):")
    print(persons[["name", "text"]].head())

    # ==============================
    # STEP 7: OPTIONAL (IF LOCATIONS EXIST)
    # ==============================
    locations = process_locations(data)
    if not locations.empty:
        print("\n📍 Locations Data (with AI-ready text):")
        print(locations[["person_id", "text"]].head())

    print("\n✅ STEP 1 COMPLETED SUCCESSFULLY")
