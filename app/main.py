from fastapi import FastAPI, Request, HTTPException, Depends
from auth import router as auth_router
from auth import get_current_user_token
# from auth import user_tokens # Will be replaced by token-based auth
from product import search_products, add_product_to_cart
from location import token_to_location_id_map
# from location import user_locations # Will be replaced by token-based auth
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os
from product import router as product_router
# from cart import router as cart_router
# from cart import handle_add_to_cart  
from pydantic import BaseModel
import requests
from llm import get_ingredients_from_ai # Corrected import
from fastapi.middleware.cors import CORSMiddleware

KROGER_API_BASE = "https://api.kroger.com/v1"
app = FastAPI()

EXTENSION_ID = "gnbofkahkklcaejogidhhfodbelabiin" # Your extension ID

origins = [
    f"chrome-extension://{EXTENSION_ID}",
    # Add other origins like "http://localhost:3000" if needed for other frontends
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to the directory containing main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")


app.include_router(auth_router, prefix="/auth") # Added /auth prefix
templates = Jinja2Templates(directory=TEMPLATES_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static") # Use robust path, ensure only one mount
app.include_router(product_router)
from location import router as location_router # Import location router
from location import router as location_router # Import location router
app.include_router(location_router) # Include location router
#app.include_router(cart_router)

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
    description: str  # New field
    transcript: str   # New field

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
    try:
        # Call the function from llm.py with new arguments
        ingredients = get_ingredients_from_ai(
            title=request.title,
            link=request.link,
            description=request.description, # Pass description
            transcript=request.transcript    # Pass transcript
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

@app.post("/process_ingredient")
async def process_ingredient(request: ProcessIngredientRequest, token: str = Depends(get_current_user_token)): # Removed request_obj: Request
    try: # UNCOMMENTED
        # Retrieve the user's saved location and token
        if token not in token_to_location_id_map:
            # THIS IS THE EXCEPTION WE ARE TESTING
            raise HTTPException(status_code=400, detail="Location not set for this token. Please save a location first.")

        location_id = token_to_location_id_map[token] # This line should be indented under try

        # All subsequent logic also needs to be indented under try
        product_search_result = search_products(token, request.ingredient, location_id)
        # print(product_search_result) # For debugging

        if not product_search_result or \
           not isinstance(product_search_result, dict) or \
           "upc" not in product_search_result:
            return {"status": "skipped", "reason": "Product not found or invalid product data from search_products"}

        product_upc = product_search_result["upc"]

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        url = f"{KROGER_API_BASE}/cart/add"

        payload = {
            "items": [
                {
                    "upc": product_upc,
                    "quantity": 1,
                    "modality": "DELIVERY",
                    "locationId": location_id
                }
            ]
        }

        response = requests.put(url, json=payload, headers=headers)
        if not (200 <= response.status_code < 300):
            try:
                error_detail = response.json()
            except requests.exceptions.JSONDecodeError:
                error_detail = {"error": "Non-JSON response from Kroger API", "content": response.text}
            raise HTTPException(status_code=response.status_code, detail=error_detail)

        return {"status": "added", "ingredient": request.ingredient}

    except HTTPException: # Added to re-raise HTTPExceptions directly
        raise
    except Exception as e: # Catch other unexpected errors
        # Log the error e for debugging
        print(f"Unexpected error in /process_ingredient: {e}") # Or use proper logging
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")

    # return {"message": "Temporarily simplified for debugging the 400 error."} # Removed placeholder

# Dummy endpoint for testing get_current_user_token
@app.get("/_test_auth_token_route")
async def test_auth_token_route(token: str = Depends(get_current_user_token)):
    return {"token": token}