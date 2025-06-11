let accessToken = ""; // Will store the user's access token here
let selectedLocationId = ""; // Store the selected location ID

// Handle login (redirects to the Kroger OAuth)
document.getElementById("login-btn").addEventListener("click", function () {
    // Ensure this points to your FastAPI backend (change localhost:8000 to your server address)
    window.location.href = "http://localhost:8000/login"; 
});

// Check if the user is logged in and get the access token from the backend
async function checkLoginStatus() {
    const response = await fetch("/check-login", { method: "GET" });
    const data = await response.json();

    if (data.logged_in) {
        accessToken = data.access_token; // Store the access token
        // Update UI to reflect logged-in state
        document.getElementById("login-section").style.display = 'none';
        document.getElementById("product-search-section").style.display = 'block';
        document.getElementById("location-section").style.display = 'block';
    } else {
        document.getElementById("login-section").style.display = 'block';
    }
}

// Fetch locations based on ZIP code
document.getElementById("find-location-btn").addEventListener("click", async () => {
    const zipCode = document.getElementById("zip-code-input").value;
    const locationSelect = document.getElementById("location-select");

    const response = await fetch(`/locations?zip_code=${zipCode}`);
    const data = await response.json();

    locationSelect.innerHTML = ""; // Clear previous options
    data.data.forEach(location => {
        const option = document.createElement("option");
        option.value = location.locationId;
        option.textContent = location.name;
        locationSelect.appendChild(option);
    });

    locationSelect.disabled = false;
});

// Enable the "Analyze" section after selecting a location
document.getElementById("location-select").addEventListener("change", async (event) => {
    const locationId = event.target.value;

    if (locationId) {
        // Save the selected location
        await fetch("/save-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location_id: locationId }),
        });

        alert("Location saved successfully!");

        // Enable the "Analyze" section
        document.getElementById("analyze-section").style.display = "block";
        document.getElementById("analyze-btn").disabled = false;
        document.getElementById("add-ingredients-btn").disabled = false;
    }
});

// Handle "Analyze" button click
document.getElementById("analyze-btn").addEventListener("click", async () => {
    const title = document.getElementById("video-title").value;
    const link = document.getElementById("video-link").value;

    if (!title || !link) {
        alert("Please provide both the video title and link.");
        return;
    }

    try {
        // Fetch ingredients from the backend
        const response = await fetch("/get_ingredients", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ title, link }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to fetch ingredients.");
        }

        const data = await response.json();
        const ingredientsList = document.getElementById("ingredients-list");
        ingredientsList.innerHTML = ""; // Clear previous results

        data.ingredients.forEach((ingredient) => {
            const li = document.createElement("li");
            li.textContent = ingredient;
            ingredientsList.appendChild(li);
        });

        alert("Ingredients fetched successfully!");
    } catch (error) {
        console.error("Error fetching ingredients:", error);
        alert(`Error: ${error.message}`);
    }
});

// Save selected location
document.getElementById("location-select").addEventListener("change", async (event) => {
    const locationId = event.target.value;

    await fetch("/save-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: locationId }),
    });

    alert("Location saved successfully!");
});

// Handle product search
document.getElementById("search-btn").addEventListener("click", async () => {
    const query = document.getElementById("search-input").value;
    const resultsDiv = document.getElementById("results");

    try {
        // Call the backend `/products` endpoint with only the query parameter
        const response = await fetch(`/product?query=${query}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to fetch products");
        }

        const data = await response.json();

        // Render the results
        renderProductResults(data, resultsDiv);
    } catch (error) {
        console.error("Error fetching products:", error);
        resultsDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
});

async function addToCart(upc) {
    try {
        const payload = {
            upc: upc,
            quantity: 1, // Default quantity
            modality: "DELIVERY" // Default modality
        };

        const response = await fetch("/cartadd", {
            method: "PUT", // Ensure this matches the API's required method
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to add product to cart");
        }

        alert("Product added to cart successfully!");

        // Refresh the cart items after adding to cart
        await refreshCart();
    } catch (error) {
        console.error("Error adding product to cart:", error);
        alert(`Error: ${error.message}`);
    }
}

// Add event listeners to "Add to Cart" buttons
document.querySelectorAll(".add-to-cart-btn").forEach(button => {
    button.addEventListener("click", async (event) => {
        const upc = event.target.getAttribute("data-id");

        try {
            const payload = {
                upc: upc,
                quantity: 1, // Default quantity
                modality: "DELIVERY" // Default modality
            };

            const response = await fetch("/cartadd", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to add product to cart");
            }

            alert("Product added to cart successfully!");
        } catch (error) {
            console.error("Error adding product to cart:", error);
            alert(`Error: ${error.message}`);
        }
    });
});

document.getElementById("results").addEventListener("click", async function (event) {
  if (event.target.classList.contains("add-to-cart-btn")) {
    const productId = event.target.getAttribute("data-product-id");
}});

// Handle "Add Ingredients to Cart" button
document.getElementById("add-ingredients-btn").addEventListener("click", async () => {
    const ingredientsList = document.querySelectorAll("#ingredients-list li");
    const ingredients = Array.from(ingredientsList).map((li) => li.textContent);

    try {
        for (const ingredient of ingredients) {
            const result = await fetch("/process_ingredient", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ingredient }),
            });

            const resultData = await result.json();
            if (result.ok && resultData.status === "added") {
                console.log(`Added to cart: ${ingredient}`);
            } else {
                console.log(`Skipped: ${ingredient} (not available in Kroger)`);
            }
        }

        alert("All ingredients processed. Check the console for details.");
    } catch (error) {
        console.error("Error processing ingredients:", error);
        alert(`Error: ${error.message}`);
    }
});

// Run the checkLoginStatus function when the page loads
window.addEventListener("load", checkLoginStatus);

document.addEventListener("DOMContentLoaded", async () => {
    const loginBtn = document.getElementById("login-btn");
    const loginStatus = document.getElementById("login-status");

    try {
        // Check login status by making a request to the backend
        const response = await fetch("/login-status");
        const data = await response.json();

        if (data.logged_in) {
            // If the user is logged in, disable the button and show the status
            loginBtn.disabled = true;
            loginStatus.style.display = "block";
            loginStatus.textContent = "Logged in Successfully";
        } else {
            // If the user is not logged in, enable the button
            loginBtn.disabled = false;
            loginBtn.addEventListener("click", () => {
                window.location.href = "/login";
            });
        }
    } catch (error) {
        console.error("Error checking login status:", error);
        loginBtn.disabled = false; // Enable the button in case of an error
    }
});

function renderProductResults(data, resultsDiv) {
    resultsDiv.innerHTML = ""; // Clear previous results

    if (data.data && data.data.length > 0) {
        const table = document.createElement("table");
        table.className = "product-table";

        const headers = `
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Description</th>
                    <th>Brand</th>
                    <th>Price</th>
                    <th>Size</th>
                    <th>Action</th>
                </tr>
            </thead>
        `;
        table.innerHTML = headers;

        const tbody = document.createElement("tbody");
        const products = data.data.slice(0, 5); // Limit to 5 results
        products.forEach(product => {
            const imageUrl = product.images?.[0]?.sizes?.find(size => size.size === "medium")?.url || "";
            const description = product.description || "N/A";
            const brand = product.brand || "N/A";
            const price = product.items?.[0]?.price?.regular || "N/A";
            const size = product.items?.[0]?.size || "N/A";

            const row = `
                <tr>
                    <td><img src="${imageUrl}" alt="${description}" width="50"></td>
                    <td>${description}</td>
                    <td>${brand}</td>
                    <td>$${price}</td>
                    <td>${size}</td>
                    <td><button class="add-to-cart-btn" data-id="${product.upc}">Add to Cart</button></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        table.appendChild(tbody);
        resultsDiv.appendChild(table);

        // Add event listeners to "Add to Cart" buttons
        document.querySelectorAll(".add-to-cart-btn").forEach(button => {
            button.addEventListener("click", async (event) => {
                const upc = event.target.getAttribute("data-id");
                await addToCart(upc);
            });
        });
    } else {
        resultsDiv.innerHTML = "<p>No products found.</p>";
    }
}

