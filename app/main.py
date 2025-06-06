from fastapi import FastAPI, Request, HTTPException
from auth import router as auth_router
from auth import user_tokens
from product import search_products
from location import search_locations
from location import user_locations
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os
from product import router as product_router
# from cart import router as cart_router
# from cart import handle_add_to_cart  
from pydantic import BaseModel
import requests

KROGER_API_BASE = "https://api.kroger.com/v1"
app = FastAPI()

app.include_router(auth_router)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(product_router)
#app.include_router(cart_router)

@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "PICKUP"  # Default to "PICKUP"

@app.get("/login")
async def login(request: Request):
    # Simulate getting tokens after OAuth authentication
    # Replace this with actual OAuth logic
    token_data = {
        'refresh_token': 'your_refresh_token',
        'access_token': 'your_access_token',
        'token_type': 'bearer',
        'expires_in': 1800
    }

    user_id = request.client.host  # Use the user's IP address as an identifier (or another unique ID)

    # Store token data in memory (you can store it in a database or session in production)
    user_tokens[user_id] = token_data

    # Send the token data back to the frontend
    return JSONResponse(content=token_data)




@app.get("/welcome")
def welcome(request: Request):
    user_id = request.client.host
    tokens = user_tokens.get(user_id)

    if not tokens:
        return {"message": "No token found. Please login again."}
    
    # Handle missing scope gracefully by using a default value
    scope = tokens.get('scope', 'unknown')  # Default to 'unknown' if 'scope' is not found

    return {
        "message": "Login successful!",
        "access_token": tokens['access_token'],
        "expires_in": tokens['expires_in'],
        "token_type": tokens['token_type'],
        "scope": scope  # You can omit or set a default value if 'scope' is not available
    }

@app.get("/login-status")
def login_status(request: Request):
    user_id = request.client.host  # Use the user's IP address as an identifier
    if user_id in user_tokens:
        return {"logged_in": True}
    return {"logged_in": False}

@app.get("/locations")
def get_locations(zip_code: str, request: Request):
    user_id = request.client.host
    print('In Location Function')
    print(user_id)
    print(user_tokens)
    token_data = user_tokens.get(user_id)
    print(token_data)
    if not token_data:
        raise HTTPException(status_code=401, detail="User not logged in")

    token = token_data["access_token"]
    return search_locations(token, zip_code, request)

@app.get("/product")
def get_products(query: str, request: Request):
    print('In Products Function')
    user_id = request.client.host
    print(user_id not in user_tokens)
    print(user_id not in user_locations)

    if user_id not in user_tokens or user_id not in user_locations:
        raise HTTPException(status_code=401, detail="User not logged in or location not set")
    token_data = user_tokens.get(user_id)
    location_id = user_locations[user_id]
    token = token_data["access_token"]
    return search_products(token, query, location_id, request)

@app.get("/product")
def get_products(query: str, request: Request):
    print('In Products Function')
    user_id = request.client.host
    print(user_id not in user_tokens)
    print(user_id not in user_locations)

    if user_id not in user_tokens or user_id not in user_locations:
        raise HTTPException(status_code=401, detail="User not logged in or location not set")
    token_data = user_tokens.get(user_id)
    location_id = user_locations[user_id]
    token = token_data["access_token"]
    return search_products(token, query, location_id, request)

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "PICKUP"  # Default to "PICKUP"

@app.post("/cartadd")
def add_to_cart(request_body: AddToCartRequest, request: Request):
    user_id = request.client.host
    print('In Add to Cart Function')
    # Check if the user is logged in and has a location set
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
    if response.status_code != 200:
        try:
            error_detail = response.json()
        except requests.exceptions.JSONDecodeError:
            error_detail = {"error": "Non-JSON response from API", "content": response.text}
        raise HTTPException(status_code=response.status_code, detail=error_detail)

    return {"message": "Product added to cart successfully"}