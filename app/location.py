import requests
from fastapi import HTTPException, Request, APIRouter
from auth import user_tokens

router = APIRouter()
user_locations = {}
KROGER_API_BASE = "https://api.kroger.com/v1"

def search_locations(token: str, zip_code: str, request: Request):
    user_id = request.client.host  # Access the user's IP address
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://api.kroger.com/v1/locations?filter.zipCode.near={zip_code}"

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    return response.json()

@router.get("/locations")
def search_locations(token: str, zip_code: str, request: Request):
    print('In Search Locations Function')
    user_id = request.client.host  # Access the user's IP address
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://api.kroger.com/v1/locations?filter.zipCode.near={zip_code}"

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    locations = response.json().get("data", [])
    if not locations:
        raise HTTPException(status_code=404, detail="No locations found")

    # Automatically select the first location and save it
    first_location = locations[0]
    user_locations[user_id] = first_location["locationId"]
    print(user_locations)

    return response.json()

    # return {
    #     "message": "Locations retrieved successfully",
    #     "locations": locations,
    #     "selected_location": first_location,
    # }

# @router.get("/locations")
# def search_locations(zip_code: str, request: Request):
#     user_id = request.client.host
#     if user_id not in user_tokens:
#         raise HTTPException(status_code=401, detail="User not logged in")

#     token = user_tokens[user_id]["access_token"]
#     headers = {"Authorization": f"Bearer {token}"}
#     url = f"https://api.kroger.com/v1/locations?filter.zipCode.near={zip_code}"

#     response = requests.get(url, headers=headers)
#     return response.json()



@router.post("/save-location")
def save_location(location_id: str, request: Request):
    user_id = request.client.host
    if user_id not in user_tokens:
        raise HTTPException(status_code=401, detail="User not logged in")

    user_locations[user_id] = location_id
    return {"message": "Location saved successfully"}
