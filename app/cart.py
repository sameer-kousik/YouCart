import requests
from fastapi import HTTPException, APIRouter
from pydantic import BaseModel
from .auth import user_tokens
from .location import user_locations

KROGER_API_BASE = "https://api.kroger.com/v1"

router = APIRouter()

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "PICKUP"  # Default to "PICKUP"

@router.get("/cart/add")
def handle_add_to_cart(request_body: AddToCartRequest, user_id: str):
    if user_id not in user_tokens or user_id not in user_locations:
        raise HTTPException(status_code=401, detail="User not logged in or location not set")

    # Retrieve the token and location_id from the backend
    token = user_tokens[user_id]["access_token"]
    location_id = user_locations[user_id]

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{KROGER_API_BASE}/cart/add"

    # Prepare the payload
    payload = {
        "items": [
            {
                "upc": request_body.upc,
                "quantity": request_body.quantity,
                "modality": request_body.modality,
                "locationId": location_id
            }
        ]
    }

    # Make the API call
    response = requests.post(url, json=payload, headers=headers)
    if not (200 <= response.status_code < 300):
        try:
            error_detail = response.json()
        except requests.exceptions.JSONDecodeError:
            error_detail = {"error": "Non-JSON response from API", "content": response.text}
        raise HTTPException(status_code=response.status_code, detail=error_detail)

    return {"message": "Product added to cart successfully"}