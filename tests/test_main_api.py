import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.location import token_to_location_id_map # To manipulate for tests

client = TestClient(app)

class TestMainAPI(unittest.TestCase):

    def tearDown(self):
        # Clean up the map after each test to ensure test isolation for protected routes
        token_to_location_id_map.clear()

    # --- Tests for GET /product ---
    def test_get_product_no_token(self):
        response = client.get("/product?query=test")
        self.assertEqual(response.status_code, 401)

    def test_get_product_token_no_location_saved(self):
        mock_token = "user_without_location"
        # Ensure token is not in token_to_location_id_map (cleared by tearDown)
        response = client.get(
            "/product?query=test",
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Location not set", response.json()["detail"])

    @patch('app.main.search_products') # Mocking the imported search_products function
    def test_get_product_success(self, mock_search_products):
        mock_token = "test_valid_token"
        mock_location_id = "test_location_123"

        # Setup: User has a saved location
        token_to_location_id_map[mock_token] = mock_location_id

        # Configure mock for search_products
        expected_product_data = {"upc": "123", "name": "Test Product"}
        mock_search_products.return_value = expected_product_data

        response = client.get(
            "/product?query=test_query",
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected_product_data)

        # Check that search_products was called correctly
        mock_search_products.assert_called_once_with(
            mock_token, "test_query", mock_location_id # request object no longer passed
        )

        # Cleanup (redundant due to tearDown but good practice if not using class-level clear)
        if mock_token in token_to_location_id_map:
            del token_to_location_id_map[mock_token]

    # --- Placeholder for /cartadd tests ---
    def test_cart_add_no_token(self):
        response = client.put("/cartadd", json={"upc": "123", "quantity": 1})
        self.assertEqual(response.status_code, 401)

    def test_cart_add_token_no_location_saved(self):
        mock_token = "user_without_location_cart"
        response = client.put(
            "/cartadd",
            headers={"Authorization": f"Bearer {mock_token}"},
            json={"upc": "123", "quantity": 1}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Location not set", response.json()["detail"])

    @patch('app.main.requests.put')
    def test_cart_add_success(self, mock_kroger_put):
        mock_token = "test_valid_token_cart"
        mock_location_id = "test_location_cart_123"
        token_to_location_id_map[mock_token] = mock_location_id

        mock_kroger_put.return_value = MagicMock(status_code=200, json=lambda: {"message": "Kroger success"})

        payload = {"upc": "test_upc", "quantity": 2, "modality": "PICKUP"}
        response = client.put(
            "/cartadd",
            headers={"Authorization": f"Bearer {mock_token}"},
            json=payload
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Product added to cart successfully"})
        mock_kroger_put.assert_called_once()
        args, kwargs = mock_kroger_put.call_args
        self.assertEqual(kwargs['json']['items'][0]['upc'], "test_upc")
        self.assertEqual(kwargs['json']['items'][0]['locationId'], mock_location_id)
        self.assertIn(f"Bearer {mock_token}", kwargs['headers']['Authorization'])

    @patch('app.main.requests.put')
    def test_cart_add_success_kroger_201(self, mock_kroger_put): # Test for 201 from Kroger
        mock_token = "test_valid_token_cart_201"
        mock_location_id = "test_location_cart_201"
        token_to_location_id_map[mock_token] = mock_location_id

        mock_kroger_put.return_value = MagicMock(status_code=201, json=lambda: {"message": "Kroger item created"})

        payload = {"upc": "test_upc_201", "quantity": 1}
        response = client.put(
            "/cartadd",
            headers={"Authorization": f"Bearer {mock_token}"},
            json=payload
        )
        self.assertEqual(response.status_code, 200) # Our API returns 200
        self.assertEqual(response.json(), {"message": "Product added to cart successfully"})

    @patch('app.main.requests.put')
    def test_cart_add_kroger_api_error(self, mock_kroger_put):
        mock_token = "test_valid_token_cart_err"
        mock_location_id = "test_location_cart_err"
        token_to_location_id_map[mock_token] = mock_location_id

        mock_kroger_put.return_value = MagicMock(
            status_code=400,
            json=lambda: {"error": "Bad Request from Kroger"},
            text="Kroger error text"
        )

        payload = {"upc": "test_upc_err", "quantity": 1}
        response = client.put(
            "/cartadd",
            headers={"Authorization": f"Bearer {mock_token}"},
            json=payload
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], {"error": "Bad Request from Kroger"})

    # --- Placeholder for /process_ingredient tests ---
    def test_process_ingredient_no_token(self):
        response = client.post("/process_ingredient", json={"ingredient": "salt"})
        self.assertEqual(response.status_code, 401)

    @patch('app.main.search_products') # Added mock for search_products
    def test_process_ingredient_token_no_location(self, mock_search_products):
        mock_token = "proc_ing_no_loc_token"
        # mock_search_products should not be called if the prior check for location works.
        # If it is called, it means the test is failing to trigger the "Location not set" HTTPException.

        response = client.post(
            "/process_ingredient",
            headers={"Authorization": f"Bearer {mock_token}"},
            json={"ingredient": "salt"}
        )
        self.assertEqual(response.status_code, 400) # Restored original assertion
        self.assertIn("Location not set", response.json()["detail"]) # Restored original assertion


    @patch('app.main.requests.put') # Mocks Kroger cart add call
    @patch('app.main.search_products') # Mocks internal call to search_products
    def test_process_ingredient_product_not_found(self, mock_search_products, mock_kroger_cart_add_put):
        mock_token = "proc_ing_prod_not_found_token"
        mock_location_id = "proc_ing_loc_1"
        token_to_location_id_map[mock_token] = mock_location_id

        mock_search_products.return_value = None # Simulate product not found by search_products

        response = client.post(
            "/process_ingredient",
            headers={"Authorization": f"Bearer {mock_token}"},
            json={"ingredient": "obscure_item"}
        )
        self.assertEqual(response.status_code, 200) # Endpoint itself doesn't fail for this
        self.assertEqual(response.json()["status"], "skipped")
        self.assertIn("Product not found", response.json()["reason"])
        mock_search_products.assert_called_once_with(mock_token, "obscure_item", mock_location_id) # request object no longer passed
        mock_kroger_cart_add_put.assert_not_called() # Cart add should not be called

    @patch('app.main.requests.put') # Mocks Kroger cart add call
    @patch('app.main.search_products') # Mocks internal call to search_products
    def test_process_ingredient_cart_add_fails(self, mock_search_products, mock_kroger_cart_add_put):
        mock_token = "proc_ing_cart_fail_token"
        mock_location_id = "proc_ing_loc_2"
        token_to_location_id_map[mock_token] = mock_location_id

        # search_products returns a valid product
        mock_search_products.return_value = {"upc": "found_upc_123", "name": "Found Product"}

        # Kroger cart add call fails
        mock_kroger_cart_add_put.return_value = MagicMock(
            status_code=500,
            json=lambda: {"error": "Kroger server error during cart add"},
            text="Kroger server error text"
        )

        response = client.post(
            "/process_ingredient",
            headers={"Authorization": f"Bearer {mock_token}"},
            json={"ingredient": "searchable_item"}
        )
        self.assertEqual(response.status_code, 500)
        # For 500 errors, FastAPI might stringify the detail if it's not a string.
        # The exact format can be tricky. Let's check if the core error message is present.
        # If error_detail was {"error": "Kroger server error during cart add"},
        # the actual detail might be a string representation of that, or just a generic server error message
        # depending on FastAPI's 500 error handling when detail is not a string.
        # The prior run showed: "500: {'error': 'Kroger server error during cart add'}"
        # This was due to the generic except Exception stringifying the HTTPException detail.
        # With `except HTTPException: raise`, the detail should remain a dict.
        self.assertEqual(response.json()['detail'], {"error": "Kroger server error during cart add"})
        mock_search_products.assert_called_once_with(mock_token, "searchable_item", mock_location_id) # request object no longer passed
        mock_kroger_cart_add_put.assert_called_once() # Cart add was attempted

    @patch('app.main.requests.put') # Mocks Kroger cart add call
    @patch('app.main.search_products') # Mocks internal call to search_products
    def test_process_ingredient_success(self, mock_search_products, mock_kroger_cart_add_put):
        mock_token = "proc_ing_success_token"
        mock_location_id = "proc_ing_loc_3"
        token_to_location_id_map[mock_token] = mock_location_id
        ingredient_name = "test_salt"

        mock_search_products.return_value = {"upc": "salt_upc_789", "name": "Test Salt"}
        mock_kroger_cart_add_put.return_value = MagicMock(status_code=200, json=lambda: {"message": "Item added by Kroger"})

        response = client.post(
            "/process_ingredient",
            headers={"Authorization": f"Bearer {mock_token}"},
            json={"ingredient": ingredient_name}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "added")
        self.assertEqual(response.json()["ingredient"], ingredient_name)

        mock_search_products.assert_called_once_with(mock_token, ingredient_name, mock_location_id) # request object no longer passed
        mock_kroger_cart_add_put.assert_called_once()
        args_put, kwargs_put = mock_kroger_cart_add_put.call_args
        self.assertEqual(kwargs_put['json']['items'][0]['upc'], "salt_upc_789")
        self.assertEqual(kwargs_put['json']['items'][0]['locationId'], mock_location_id)
        self.assertIn(f"Bearer {mock_token}", kwargs_put['headers']['Authorization'])

    # --- Tests for POST /get_ingredients ---
    @patch('app.main.get_ingredients_from_ai')
    def test_get_ingredients_success(self, mock_get_ingredients_from_ai):
        mock_video_request_data = {
            "title": "Test Video",
            "link": "https://youtube.com/test",
            "description": "A test description.",
            "transcript": "Test transcript content."
        }
        expected_ingredients = ["ingredient1", "ingredient2 from description and transcript"]
        mock_get_ingredients_from_ai.return_value = expected_ingredients

        response = client.post("/get_ingredients", json=mock_video_request_data)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ingredients": expected_ingredients})
        mock_get_ingredients_from_ai.assert_called_once_with(
            title=mock_video_request_data["title"],
            link=mock_video_request_data["link"],
            description=mock_video_request_data["description"],
            transcript=mock_video_request_data["transcript"]
        )

    def test_get_ingredients_invalid_payload(self):
        # Missing description and transcript
        mock_video_request_data = {
            "title": "Test Video",
            "link": "https://youtube.com/test"
            # "description": "A test description.", (missing)
            # "transcript": "Test transcript content." (missing)
        }
        response = client.post("/get_ingredients", json=mock_video_request_data)
        self.assertEqual(response.status_code, 422) # Unprocessable Entity

if __name__ == '__main__':
    unittest.main()
