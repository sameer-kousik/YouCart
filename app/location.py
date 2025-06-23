import requests
from fastapi import HTTPException, Request, APIRouter, Depends
from pydantic import BaseModel
from auth import get_current_user_token 
import json # Added
import os # Added
from typing import Dict # Added

# Define the path for the JSON file.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCATION_MAP_FILE = os.path.join(BASE_DIR, "kroger_location_map.json")

router = APIRouter()

def load_location_map() -> Dict[str, str]:
    if os.path.exists(LOCATION_MAP_FILE):
        try:
            with open(LOCATION_MAP_FILE, "r") as f:
                data = json.load(f)
                print(f"Location map loaded from {LOCATION_MAP_FILE}")
                return data
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error loading location map from {LOCATION_MAP_FILE}: {e}. Starting with an empty map.")
            return {}
    return {}

def save_location_map(data: Dict[str, str]) -> None:
    try:
        with open(LOCATION_MAP_FILE, "w") as f:
            json.dump(data, f, indent=4) # Use indent for readability
            print(f"Location map saved to {LOCATION_MAP_FILE}")
    except IOError as e:
        print(f"Error saving location map to {LOCATION_MAP_FILE}: {e}")

token_to_location_id_map: Dict[str, str] = load_location_map() # Modified initialization
KROGER_API_BASE = "https://api.kroger.com/v1"

# The old standalone search_locations function might be removed or refactored if not used elsewhere.
# For now, focusing on the endpoint.

@router.get("/locations")
async def get_kroger_locations(zip_code: str, token: str = Depends(get_current_user_token)): # request: Request removed
    # print('In Search Locations Function') # Old print
    # user_id = request.client.host  # Removed
    headers = {"Authorization": f"Bearer {token}"} # Use injected token
    url = f"https://api.kroger.com/v1/locations?filter.zipCode.near={zip_code}"

    response = requests.get(url, headers=headers)
    if not response.ok: # Changed to response.ok for broader success codes (200-299)
        # Consider logging response.text for more detailed error info from Kroger
        raise HTTPException(status_code=response.status_code, detail=response.json())

    # locations = response.json().get("data", []) # Old logic for saving first location
    # if not locations:
    #     raise HTTPException(status_code=404, detail="No locations found")

    # # Automatically select the first location and save it - REMOVED
    # first_location = locations[0]
    # user_locations[user_id] = first_location["locationId"] # Removed, user_locations is gone
    # print(user_locations) # Removed

    return response.json().get("data", []) # As per instruction, or response.json()

    # return { # Old return structure
    #     "message": "Locations retrieved successfully",
    #     "locations": locations,
    #     "selected_location": first_location,
    # }

# @router.get("/locations") # This is a commented out alternative version
# def search_locations(zip_code: str, request: Request):
#     user_id = request.client.host
#     if user_id not in user_tokens:
#         raise HTTPException(status_code=401, detail="User not logged in")

#     token = user_tokens[user_id]["access_token"]
#     headers = {"Authorization": f"Bearer {token}"}
#     url = f"https://api.kroger.com/v1/locations?filter.zipCode.near={zip_code}"

#     response = requests.get(url, headers=headers)
#     return response.json()



class LocationSaveRequest(BaseModel):
    location_id: str

@router.post("/save-location")
async def save_location_route(location_data: LocationSaveRequest, token: str = Depends(get_current_user_token)):
    # user_id = request.client.host # Removed
    # if user_id not in user_tokens: # Removed
    #     raise HTTPException(status_code=401, detail="User not logged in")

    token_to_location_id_map[token] = location_data.location_id
    save_location_map(token_to_location_id_map) # Added call to save the map
    return {"message": "Location saved successfully", "token_used_as_key": token, "location_id_saved": location_data.location_id }
