import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import os

# Set environment variables for Kroger Client ID and Secret BEFORE importing app modules
# that might use them at import time.
os.environ["KROGER_CLIENT_ID"] = "test_client_id"
os.environ["KROGER_CLIENT_SECRET"] = "test_client_secret"
os.environ["KROGER_REDIRECT_URI"] = "https://localhost/callback" # Dummy redirect URI

from app.main import app # Main FastAPI app
from app.auth import router as auth_router # Auth router, ensure app.auth for consistency if needed

# It's often better to test routers included in the main app via the main app's TestClient,
# but if app.auth defines routes not included in main.app for some reason,
# you might need a client for auth_router too.
# For now, assuming all relevant auth routes are in main.app.
client = TestClient(app)

class TestAuth(unittest.TestCase):

    @patch('app.auth.requests.post')
    def test_exchange_code_success(self, mock_post):
        # Configure the mock for a successful response from Kroger
        mock_kroger_response = MagicMock()
        mock_kroger_response.ok = True
        mock_kroger_response.json.return_value = {
            "access_token": "fake_access_token",
            "refresh_token": "fake_refresh_token",
            "expires_in": 3600,
            "token_type": "bearer"
        }
        mock_post.return_value = mock_kroger_response

        payload = {
            "code": "valid_auth_code",
            "redirect_uri": "https://localhost/callback" # Must match what's configured if checked by endpoint
        }
        response = client.post("/auth/exchange_code", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["access_token"], "fake_access_token")
        mock_post.assert_called_once()
        # Optionally, assert the call arguments to mock_post if KROGER_CLIENT_ID etc. are important for this test
        # args, kwargs = mock_post.call_args
        # self.assertEqual(kwargs['data']['client_id'], "test_client_id")


    @patch('app.auth.requests.post')
    def test_exchange_code_failure_kroger_api(self, mock_post):
        # Configure the mock for a failed response from Kroger
        mock_kroger_response = MagicMock()
        mock_kroger_response.ok = False
        mock_kroger_response.status_code = 400
        mock_kroger_response.text = "Kroger API Error Detail"
        mock_kroger_response.json.return_value = {"error": "invalid_grant", "error_description": "The code is invalid or expired."}
        mock_post.return_value = mock_kroger_response

        payload = {
            "code": "invalid_auth_code",
            "redirect_uri": "https://localhost/callback"
        }
        response = client.post("/auth/exchange_code", json=payload)

        self.assertEqual(response.status_code, 400)
        self.assertIn("Failed to exchange code with Kroger", response.json()["detail"])
        self.assertIn("Kroger API Error Detail", response.json()["detail"])


    def test_get_current_user_token_via_dummy_endpoint_success(self):
        test_token = "my_secret_token"
        response = client.get(
            "/_test_auth_token_route",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"token": test_token})

    def test_get_current_user_token_via_dummy_endpoint_no_header(self):
        response = client.get("/_test_auth_token_route")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Not authenticated: Missing Authorization header", response.json()["detail"])

    def test_get_current_user_token_via_dummy_endpoint_invalid_format_no_bearer(self):
        response = client.get(
            "/_test_auth_token_route",
            headers={"Authorization": "my_secret_token"} # Missing "Bearer "
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Not authenticated: Invalid token format", response.json()["detail"])

    def test_get_current_user_token_via_dummy_endpoint_invalid_format_wrong_spacing(self):
        response = client.get(
            "/_test_auth_token_route",
            headers={"Authorization": "BearerToken my_secret_token"} # Wrong spacing
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Not authenticated: Invalid token format", response.json()["detail"])

    def test_get_current_user_token_via_dummy_endpoint_bearer_only(self):
        response = client.get(
            "/_test_auth_token_route",
            headers={"Authorization": "Bearer "}
        )
        self.assertEqual(response.status_code, 401)
        # This specific case might depend on how split behaves with trailing space,
        # but the "len(parts) == 1" check in get_current_user_token should catch it.
        self.assertIn("Not authenticated: Invalid token format", response.json()["detail"])


    # Tests for /login-status (which is in app.auth router)
    def test_login_status_with_valid_token(self):
        # This uses the actual /login-status endpoint, now prefixed
        response = client.get("/auth/login-status", headers={"Authorization": "Bearer valid_token"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"logged_in": True, "message": "Token provided."})

    def test_login_status_with_missing_token(self):
        response = client.get("/auth/login-status") # No Authorization header, path prefixed
        self.assertEqual(response.status_code, 401) # Expect 401 due to get_current_user_token dependency
        self.assertIn("Not authenticated: Missing Authorization header", response.json()["detail"])


if __name__ == '__main__':
    unittest.main()
