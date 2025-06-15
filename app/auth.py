import os
import requests
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer # Or use custom header check
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()
user_tokens = {} # This might be re-evaluated based on new auth flow

router = APIRouter()

# If using OAuth2PasswordBearer, initialize it (though we might not use its full form)
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # Dummy tokenUrl

async def get_current_user_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated: Missing Authorization header")
    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) == 1 or len(parts) > 2:
        raise HTTPException(status_code=401, detail="Not authenticated: Invalid token format")
    token = parts[1]
    return token

KROGER_CLIENT_ID = os.getenv("KROGER_CLIENT_ID")
KROGER_CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET")
KROGER_REDIRECT_URI = os.getenv("KROGER_REDIRECT_URI")


auth_url = (
    f"https://api.kroger.com/v1/connect/oauth2/authorize?"
    f"response_type=code&client_id={KROGER_CLIENT_ID}"
    f"&redirect_uri={KROGER_REDIRECT_URI}"
    f"&scope=cart.basic:write product.compact"
)

class ExchangeCodeRequest(BaseModel):
    code: str
    redirect_uri: str # The extension's redirect URI used in the initial auth request

@router.post("/exchange_code")
async def exchange_code_for_token(payload: ExchangeCodeRequest):
    token_url = "https://api.kroger.com/v1/connect/oauth2/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "authorization_code",
        "code": payload.code,
        "redirect_uri": payload.redirect_uri, # Use the redirect_uri from the request
        "client_id": KROGER_CLIENT_ID,       # Assumes KROGER_CLIENT_ID is available
        "client_secret": KROGER_CLIENT_SECRET, # Assumes KROGER_CLIENT_SECRET is available
    }

    response = requests.post(token_url, data=data, headers=headers)
    if not response.ok:
        # Log error details for debugging
        print(f"Kroger API Error: {response.status_code} - {response.text}")
        raise HTTPException(status_code=response.status_code, detail=f"Failed to exchange code with Kroger: {response.text}")

    token_data = response.json()

    # Potentially extract user info from token_data if Kroger provides it (e.g. user_id in id_token)
    # For now, the token itself will be the primary identifier from the extension's perspective.
    # The extension will store this token_data.
    return token_data

# auth_url = (
#     f"https://api.kroger.com/v1/connect/oauth2/authorize?"
#     f"response_type=code&client_id={KROGER_CLIENT_ID}"
#     f"&redirect_uri={KROGER_REDIRECT_URI}"
#     f"&scope=cart.write cart.basic product.compact"
# )

@router.get("/login")
async def login():
    return RedirectResponse(url=auth_url)

@router.get("/callback")
def callback(code: str, request: Request):
    token_url = "https://api.kroger.com/v1/connect/oauth2/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": KROGER_REDIRECT_URI,
        "client_id": KROGER_CLIENT_ID,
        "client_secret": KROGER_CLIENT_SECRET,
    }

    response = requests.post(token_url, data=data, headers=headers)
    token_data = response.json()

    print(response.json())
    print(str(response))

    # Log the token data to inspect
    print(f"Token Data: {token_data}")

    # For now: use IP or some ID to simulate session
    # user_id = request.client.host # No longer using client.host for session key
    # user_tokens[user_id] = token_data # Server-side token cache might be re-evaluated

    # The token_data is returned directly to the caller (e.g., a web page that initiated the OAuth flow)
    # The browser extension will use the /auth/exchange_code endpoint instead.
    return token_data

@router.get("/login-status")
async def login_status(token: str = Depends(get_current_user_token)):
    # For now, simply checks if a token is provided and validly parsed.
    # Future: could introspect token or check against Kroger API
    if token:
        return {"logged_in": True, "message": "Token provided."}
    # This part might be unreachable if get_current_user_token raises HTTPException for missing token
    return {"logged_in": False, "message": "No token provided or invalid."}

@router.get("/check-login")
async def check_login(token: str = Depends(get_current_user_token)):
    # For now, simply checks if a token is provided and validly parsed.
    # Future: could introspect token or check against Kroger API
    if token:
        return {"logged_in": True, "message": "Token provided."}
    # This part might be unreachable if get_current_user_token raises HTTPException for missing token
    return {"logged_in": False, "message": "No token provided or invalid."}



