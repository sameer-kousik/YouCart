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
    """
    Search for a product in the Kroger catalog by ingredient name.
    """
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{KROGER_API_BASE}/products"
    params = {
        "filter.term": query,
        "filter.locationId": location_id,
    }

    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    products = response.json().get("data", [])
    return products[0] if products else None

def add_product_to_cart(token: str, location_id: str, upc: str):
    """
    Add a product to the Kroger cart.
    """
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{KROGER_API_BASE}/cart/add"
    payload = {
        "items": [
            {
                "upc": upc,
                "quantity": 1,
                "modality": "PICKUP",
                "locationId": location_id,
            }
        ]
    }

    response = requests.put(url, json=payload, headers=headers)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "DELIVERY"
