import requests
from fastapi import HTTPException, Request, APIRouter, Depends
from pydantic import BaseModel
from auth import get_current_user_token # Assuming get_current_user_token is in app/auth.py

router = APIRouter()
token_to_location_id_map = {} # New storage for token to location_id mapping
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
    return {"message": "Location saved successfully", "token_used_as_key": token, "location_id_saved": location_data.location_id }
