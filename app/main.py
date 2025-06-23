from fastapi import FastAPI, Request, HTTPException, Depends
from auth import router as auth_router 
from auth import get_current_user_token 
# from auth import user_tokens # Will be replaced by token-based auth
from product import search_products, add_product_to_cart 
# from location import token_to_location_id_map # No longer needed here directly
# from location import user_locations # Will be replaced by token-based auth
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os
from product import router as product_router 
# from cart import router as cart_router
# from cart import handle_add_to_cart  
from typing import Optional # Add this import
from pydantic import BaseModel
import requests
from llm import get_ingredients_from_ai
from fastapi.middleware.cors import CORSMiddleware

KROGER_API_BASE = "https://api.kroger.com/v1"
app = FastAPI()

# Path to the directory containing main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")


app.include_router(auth_router, prefix="/auth") # Added /auth prefix
templates = Jinja2Templates(directory=TEMPLATES_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static") # Use robust path, ensure only one mount
app.include_router(product_router)
from location import router as location_router # Import location router
app.include_router(location_router) # Include location router
#app.include_router(cart_router)


EXTENSION_ID = "gnbofkahkklcaejogidhhfodbelabiin" # Your exact Extension ID

origins = [
    f"chrome-extension://{EXTENSION_ID}",
    # You can add other origins here if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Crucial for preflight OPTIONS requests
    allow_headers=["*"], # Crucial for preflight OPTIONS requests
)

@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

class AddToCartRequest(BaseModel): # This is defined twice, will clean up later if it's an issue.
    upc: str
    quantity: int
    modality: str = "PICKUP"  # Default to "PICKUP"

class VideoRequest(BaseModel):
    title: str
    link: str
    description: str
    transcript_url: Optional[str] = None # Changed from transcript: str

# Removed mock /login, /welcome, and main.py's /login-status as they rely on old auth

# Removed GET /locations endpoint from main.py as it's now provided by app.location.router
# def get_locations(zip_code: str, request: Request, token: str = Depends(get_current_user_token)):
    # # user_id = request.client.host # Removed
    # # token_data = user_tokens.get(user_id) # Removed
    # # if not token_data: # Token presence is handled by get_current_user_token
    # #     raise HTTPException(status_code=401, detail="User not logged in")
    # # actual_token = token_data["access_token"] # Renamed to actual_token to avoid conflict with 'token' dependency
    # 
    # # Location data will need to be fetched based on user profile associated with the token,
    # # or passed by client. For now, search_locations might need adjustment if it requires location_id.
    # # The original search_locations function in location.py doesn't seem to use user_locations directly for its main call.
    # return search_locations(token, zip_code, request) # Pass the obtained token

@app.get("/product")
def get_products(query: str, request: Request, token: str = Depends(get_current_user_token)):
    # user_id = request.client.host # Removed
    # if user_id not in user_tokens or user_id not in user_locations: # Token and location check will change
    #     raise HTTPException(status_code=401, detail="User not logged in or location not set")
    # token_data = user_tokens.get(user_id) # Removed
    # actual_token = token_data["access_token"] # Renamed

    # TODO: location_id needs to be retrieved based on the user associated with the token.
    # This will be handled in a subsequent step (Location Management).
    # For now, this endpoint might be partially non-functional if location_id is strictly required by search_products.
    # Let's assume for now search_products can be called without a specific location_id or a default is handled.
    # The original product.py search_products takes location_id. This will need to be addressed.
    # For this subtask, focusing on removing client.host and using the Depends(get_current_user_token).
    
    if token not in token_to_location_id_map:
        raise HTTPException(status_code=400, detail="Location not set for this token. Please save a location first.")
    location_id = token_to_location_id_map[token]
    
    # If search_products requires a location_id derived from user_locations, this will fail or use a dummy.
    # The task is to remove request.client.host based auth first.
    # The function signature of search_products in product.py is (token, query, location_id)
    return search_products(token, query, location_id) # Pass obtained token and placeholder location_id

class AddToCartRequest(BaseModel):
    upc: str
    quantity: int
    modality: str = "PICKUP"  # Default to "PICKUP"

@app.put("/cartadd")
def add_to_cart(request_body: AddToCartRequest, request: Request, token: str = Depends(get_current_user_token)):
    # user_id = request.client.host # Removed
    # print('In Add to Cart Function')
    # Check if the user is logged in and has a location set
    # if user_id not in user_tokens or user_id not in user_locations: # Old checks removed
    #     raise HTTPException(status_code=401, detail="User not logged in or location not set")

    # Token is now injected by Depends(get_current_user_token)
    # actual_token = user_tokens[user_id]["access_token"] # Old way of getting token

    # TODO: location_id needs to be retrieved based on the user associated with the token.
    # This will be handled in a subsequent step (Location Management).
    if token not in token_to_location_id_map:
        raise HTTPException(status_code=400, detail="Location not set for this token. Please save a location first.")
    location_id = token_to_location_id_map[token]
    
    # print('here here here') # Debugging print
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} # Use injected token
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

    # Make the API call using PUT
    print('Making API call to add to cart')
    response = requests.put(url, json=payload, headers=headers)
    if not (200 <= response.status_code < 300): # MODIFIED CHECK
        try:
            error_detail = response.json()
        except requests.exceptions.JSONDecodeError:
            error_detail = {"error": "Non-JSON response from Kroger API", "content": response.text} # Updated error message
        raise HTTPException(status_code=response.status_code, detail=error_detail)

    return {"message": "Product added to cart successfully"} # Consider returning response.json() or response.status_code

@app.post("/get_ingredients")
async def get_ingredients(request: VideoRequest):
    print(request)
    print(f"DEBUG Main: /get_ingredients received request with title: '{request.title}', link: '{request.link}', description: '{request.description}', transcript_url: '{request.transcript_url}'")
    try:
        # Call the function from llm.py with new arguments
        ingredients = get_ingredients_from_ai(
            title=request.title,
            link=request.link,
            description=request.description,
            transcript_url=request.transcript_url # Pass transcript_url
        )
        return {"ingredients": ingredients}
    except RuntimeError as e:
        # Consider if RuntimeError is still the expected exception type from llm.py
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # Generic error handler
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

class ProcessIngredientRequest(BaseModel):
    ingredient: str
    location_id: str # New field

@app.post("/process_ingredient")
async def process_ingredient(request: ProcessIngredientRequest, token: str = Depends(get_current_user_token)):
    try:
        # Location ID is now passed directly in the request
        location_id = request.location_id 
        kroger_api_token = token # Token from Depends(get_current_user_token)

        print(f"DEBUG Main: /process_ingredient received ingredient: '{request.ingredient}', location_id: '{location_id}' using token (first 10 chars): {kroger_api_token[:10]}...")

        # Call search_products with the Kroger API token and the provided location_id
        # Ensure search_products is called with keyword arguments if its signature was changed to include kroger_api_token explicitly
        product = search_products(token=kroger_api_token, query=request.ingredient, location_id=location_id)
        
        if not product or not product.get("upc"): # Check if product is None or product dictionary is missing 'upc'
            print(f"DEBUG Main: Product '{request.ingredient}' not found or missing UPC for location '{location_id}'.")
            return {"status": "skipped", "ingredient": request.ingredient, "reason": "Product not found by search_products or UPC missing"}

        print(f"DEBUG Main: Product found: {product.get('description', 'N/A')} (UPC: {product.get('upc')})")

        # Use the add_to_cart functionality (Kroger API call)
        headers = {"Authorization": f"Bearer {kroger_api_token}", "Content-Type": "application/json"}
        cart_add_url = f"{KROGER_API_BASE}/cart/add" # Ensure KROGER_API_BASE is defined

        payload = {
            "items": [
                {
                    "upc": product["upc"],
                    "quantity": 1,  # Default quantity
                    "modality": "DELIVERY",  # Default modality, or make it configurable
                    "locationId": location_id # Use provided location_id
                }
            ]
        }

        print(f"DEBUG Main: Calling Kroger cart add API for UPC {product['upc']} at location {location_id}")
        kroger_response = requests.put(cart_add_url, json=payload, headers=headers) # Assuming PUT

        if not (200 <= kroger_response.status_code < 300):
            error_detail_msg = f"Kroger API error when adding UPC {product['upc']} to cart."
            try:
                error_detail = kroger_response.json()
                error_detail_msg = error_detail.get("error", error_detail_msg) if isinstance(error_detail, dict) else error_detail_msg
            except requests.exceptions.JSONDecodeError:
                error_detail_msg += f" Non-JSON response: {kroger_response.text}"
            print(f"DEBUG Main: {error_detail_msg}")
            return {"status": "error", "ingredient": request.ingredient, "reason": error_detail_msg, "kroger_status_code": kroger_response.status_code}


        print(f"DEBUG Main: Successfully added/updated UPC {product['upc']} in cart for location {location_id}.")
        return {"status": "added", "ingredient": request.ingredient, "product_description": product.get("description")}

    except HTTPException: # Re-raise HTTPExceptions from dependencies (like get_current_user_token)
        raise
    except Exception as e:
        print(f"DEBUG Main: Unexpected error in /process_ingredient for '{request.ingredient}': {e}") # Log the full error
        raise HTTPException(status_code=500, detail=f"Unexpected server error processing ingredient '{request.ingredient}'.")

    # return {"message": "Temporarily simplified for debugging the 400 error."} # Removed placeholder

# Dummy endpoint for testing get_current_user_token
@app.get("/_test_auth_token_route")
async def test_auth_token_route(token: str = Depends(get_current_user_token)):
    return {"token": token}