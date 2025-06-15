import requests
from fastapi import HTTPException, APIRouter, Request # Request may not be needed if not used
from pydantic import BaseModel
# from auth import user_tokens # Removed - no longer using global user_tokens
# from location import user_locations # Removed - no longer using global user_locations

router = APIRouter()

KROGER_API_BASE = "https://api.kroger.com/v1"

# user_tokens = {}  # Removed - Placeholder for user tokens
# user_locations = {}  # Removed - Placeholder for user locations

@router.get("/products") # This is also an endpoint, might need request if called as such.
# For internal calls from main.py, request might not be needed.
# Let's assume for the call from main.py's /process_ingredient, it's not essential.
def search_products(token: str, query: str, location_id: str): # Removed request: Request
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
    if not (200 <= response.status_code < 300): # MODIFIED CHECK
        try:
            error_detail = response.json()
        except requests.exceptions.JSONDecodeError:
            error_detail = {"error": "Non-JSON response from Kroger API (product search)", "content": response.text}
        raise HTTPException(status_code=response.status_code, detail=error_detail)

    products = response.json().get("data", [])
    return products[0] if products else None

def add_product_to_cart(token: str, location_id: str, upc: str): # This is a utility function in product.py
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
                "modality": "PICKUP", # Defaulting to PICKUP here
                "locationId": location_id,
            }
        ]
    }

    response = requests.put(url, json=payload, headers=headers)
    if not (200 <= response.status_code < 300): # MODIFIED CHECK
        try:
            error_detail = response.json()
        except requests.exceptions.JSONDecodeError:
            error_detail = {"error": "Non-JSON response from Kroger API (cart add utility)", "content": response.text}
        raise HTTPException(status_code=response.status_code, detail=error_detail)
    # This function doesn't currently return anything, maybe it should return response.json() or status.

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "DELIVERY"
