import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from app.cart import handle_add_to_cart, AddToCartRequest, user_tokens, user_locations

class TestCart(unittest.TestCase):

    def setUp(self):
        # Set up mock user data for testing
        self.user_id = "test_user"
        user_tokens[self.user_id] = {"access_token": "fake_token"}
        user_locations[self.user_id] = "fake_location_id"

    def tearDown(self):
        # Clean up mock user data
        if self.user_id in user_tokens:
            del user_tokens[self.user_id]
        if self.user_id in user_locations:
            del user_locations[self.user_id]

    @patch('app.cart.requests.post')
    def test_handle_add_to_cart_success_201(self, mock_post):
        # Mock the Kroger API response for 201 Created
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"data": "some data"} # Mock JSON response if any
        mock_post.return_value = mock_response

        request_body = AddToCartRequest(upc="123456789012", quantity=1)

        try:
            response = handle_add_to_cart(request_body=request_body, user_id=self.user_id)
            self.assertEqual(response, {"message": "Product added to cart successfully"})
        except HTTPException as e:
            self.fail(f"handle_add_to_cart raised HTTPException unexpectedly: {e.detail}")

    @patch('app.cart.requests.post')
    def test_handle_add_to_cart_success_204(self, mock_post):
        # Mock the Kroger API response for 204 No Content
        mock_response = MagicMock()
        mock_response.status_code = 204
        # For 204, there's typically no JSON body, but mock it just in case the code tries to access it
        mock_response.json.return_value = {}
        mock_post.return_value = mock_response

        request_body = AddToCartRequest(upc="123456789012", quantity=1)

        try:
            response = handle_add_to_cart(request_body=request_body, user_id=self.user_id)
            self.assertEqual(response, {"message": "Product added to cart successfully"})
        except HTTPException as e:
            self.fail(f"handle_add_to_cart raised HTTPException unexpectedly: {e.detail}")

    @patch('app.cart.requests.post')
    def test_handle_add_to_cart_kroger_api_error(self, mock_post):
        # Mock the Kroger API response for an error (e.g., 400)
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"error": "Bad Request"}
        mock_post.return_value = mock_response

        request_body = AddToCartRequest(upc="123456789012", quantity=1)

        with self.assertRaises(HTTPException) as context:
            handle_add_to_cart(request_body=request_body, user_id=self.user_id)

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, {"error": "Bad Request"})

    def test_handle_add_to_cart_user_not_logged_in(self):
        request_body = AddToCartRequest(upc="123456789012", quantity=1)

        with self.assertRaises(HTTPException) as context:
            handle_add_to_cart(request_body=request_body, user_id="unknown_user")

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "User not logged in or location not set")

if __name__ == '__main__':
    unittest.main()
