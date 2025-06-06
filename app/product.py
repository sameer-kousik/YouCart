import requests
from fastapi import HTTPException, APIRouter, Request
from pydantic import BaseModel
from auth import user_tokens
from location import user_locations

router = APIRouter()

KROGER_API_BASE = "https://api.kroger.com/v1"

user_tokens = {}  # Placeholder for user tokens
user_locations = {}  # Placeholder for user locations

@router.get("/products")
def search_products(token: str, query: str, location_id: str, request: Request):
    #user_id = request.client.host
    # print(user_id not in user_tokens)
    # print(user_id not in user_locations)
    # if user_id not in user_tokens or user_id not in user_locations:
    #     raise HTTPException(status_code=401, detail="User not logged in or location not set")
    #token = user_tokens[user_id]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{KROGER_API_BASE}/products"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "filter.term": query,
        "filter.locationId": location_id,
        "filter.limit": 2
    }
    print(url)
    
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())
    print(response.json())
    return response.json()

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "DELIVERY"
