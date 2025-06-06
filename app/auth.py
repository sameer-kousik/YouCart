import os
import requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv

load_dotenv()
user_tokens = {}

router = APIRouter()

KROGER_CLIENT_ID = os.getenv("KROGER_CLIENT_ID")
KROGER_CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET")
KROGER_REDIRECT_URI = os.getenv("KROGER_REDIRECT_URI")


auth_url = (
    f"https://api.kroger.com/v1/connect/oauth2/authorize?"
    f"response_type=code&client_id={KROGER_CLIENT_ID}"
    f"&redirect_uri={KROGER_REDIRECT_URI}"
    f"&scope=cart.basic:write product.compact"
)

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

    # Log the token data to inspect
    print(f"Token Data: {token_data}")

    # For now: use IP or some ID to simulate session
    user_id = request.client.host
    user_tokens[user_id] = token_data

    return RedirectResponse(url="/")

@router.get("/login-status")
def login_status(request: Request):
    user_id = request.client.host
    if user_id in user_tokens:
        return {"logged_in": True}
    return {"logged_in": False}

@router.get("/check-login")
def check_login(request: Request):
    user_id = request.client.host
    if user_id in user_tokens:
        return {"logged_in": True}
    return {"logged_in": False}



