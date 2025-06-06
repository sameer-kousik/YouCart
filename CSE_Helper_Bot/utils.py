import json
import os

USER_FILE = "data/users.json"
MATERIALS_FOLDER = "data/materials"

def load_user_data():
    if not os.path.exists(USER_FILE):
        return {}
    with open(USER_FILE, "r") as f:
        return json.load(f)

def save_user_data(data):
    with open(USER_FILE, "w") as f:
        json.dump(data, f, indent=4)

def load_material_data(year):
    file_path = os.path.join(MATERIALS_FOLDER, f"{year}_YEAR.json")
    if not os.path.exists(file_path):
        return {}
    with open(file_path, "r") as f:
        return json.load(f)
