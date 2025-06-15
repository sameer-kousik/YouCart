import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app # Main FastAPI app
# Assuming location routes are included in the main app instance
# If app.location.router is separate and not included, testing it directly might be needed.
# from app.location import router as location_router # Example if needed
from app.location import token_to_location_id_map # For direct manipulation in tests

client = TestClient(app)

class TestLocation(unittest.TestCase):

    def tearDown(self):
        # Clean up the map after each test to ensure test isolation
        token_to_location_id_map.clear()

    @patch('app.location.requests.get')
    def test_get_kroger_locations_success(self, mock_get):
        mock_token = "test_user_token"
        mock_zip = "12345"

        mock_kroger_response = MagicMock()
        mock_kroger_response.ok = True
        mock_kroger_response.json.return_value = {"data": [{"locationId": "loc1"}, {"locationId": "loc2"}]}
        mock_get.return_value = mock_kroger_response

        response = client.get(
            f"/locations?zip_code={mock_zip}", # Endpoint is /locations from app.location router
            headers={"Authorization": f"Bearer {mock_token}"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{"locationId": "loc1"}, {"locationId": "loc2"}])
        mock_get.assert_called_once()
        # Can add more assertions on mock_get.call_args if needed

    def test_get_kroger_locations_no_token(self):
        mock_zip = "12345"
        response = client.get(f"/locations?zip_code={mock_zip}") # No token
        self.assertEqual(response.status_code, 401) # get_current_user_token dependency

    @patch('app.location.requests.get')
    def test_get_kroger_locations_kroger_api_error(self, mock_get):
        mock_token = "test_user_token"
        mock_zip = "12345"

        mock_kroger_response = MagicMock()
        mock_kroger_response.ok = False
        mock_kroger_response.status_code = 500
        mock_kroger_response.json.return_value = {"error": "Kroger Internal Error"}
        mock_get.return_value = mock_kroger_response

        response = client.get(
            f"/locations?zip_code={mock_zip}",
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()['detail'], {"error": "Kroger Internal Error"})

    def test_save_location_success(self):
        mock_token = "test_user_token_for_save"
        mock_location_id = "saved_location_123"

        payload = {"location_id": mock_location_id}

        response = client.post(
            "/save-location", # Endpoint is /save-location from app.location router
            json=payload,
            headers={"Authorization": f"Bearer {mock_token}"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Location saved successfully", response.json()["message"])
        self.assertEqual(token_to_location_id_map.get(mock_token), mock_location_id)

    def test_save_location_no_token(self):
        mock_location_id = "saved_location_123"
        payload = {"location_id": mock_location_id}
        response = client.post("/save-location", json=payload) # No token
        self.assertEqual(response.status_code, 401)

    def test_save_location_invalid_payload(self):
        mock_token = "test_user_token_for_save"
        payload = {"wrong_field": "some_value"} # Missing location_id
        response = client.post(
            "/save-location",
            json=payload,
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        self.assertEqual(response.status_code, 422) # FastAPI's unprocessable entity for Pydantic errors


if __name__ == '__main__':
    unittest.main()
