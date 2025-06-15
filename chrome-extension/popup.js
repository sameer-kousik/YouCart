document.addEventListener('DOMContentLoaded', function() {
    // Initial UI Reset
    document.getElementById('ingredientsList').innerHTML = '';
    document.getElementById('locationsList').innerHTML = '';
    const statusMessages = document.getElementById('status-messages');
    statusMessages.textContent = '';
    // Sections are hidden by default via CSS now, but ensure critical buttons are also reset if needed
    // document.getElementById('location-section').style.display = 'none'; // Managed by CSS
    // document.getElementById('youtube-section').style.display = 'none'; // Managed by CSS
    // document.getElementById('ingredients-section').style.display = 'none'; // Managed by CSS
    // document.getElementById('saveLocationBtn').style.display = 'none'; // Managed by CSS
    // document.getElementById('addToCartBtn').style.display = 'none'; // Managed by CSS

    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');

    const searchLocationsBtn = document.getElementById('searchLocationsBtn');
    const zipCodeInput = document.getElementById('zipCode');
    const locationsListDiv = document.getElementById('locationsList');
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    let selectedLocationId = null;

    // Check initial auth state and location state
    chrome.storage.local.get(['kroger_access_token', 'kroger_location_id', 'kroger_token_expires_in', 'kroger_token_obtained_at'], function(result) {
        const now = Date.now();
        const isValidToken = result.kroger_access_token &&
                             result.kroger_token_obtained_at &&
                             result.kroger_token_expires_in &&
                             (now - result.kroger_token_obtained_at < (result.kroger_token_expires_in * 1000));

        if (isValidToken) {
            authSection.style.display = 'none';
            if (result.kroger_location_id) {
                statusMessages.textContent = 'Logged in and location set.';
                locationSection.style.display = 'none';
                youtubeSection.style.display = 'block'; // Or main view
            } else {
                statusMessages.textContent = 'Logged in. Please select your Kroger store.';
                locationSection.style.display = 'block';
                youtubeSection.style.display = 'none';
            }
        } else {
            statusMessages.textContent = 'Please login with Kroger.';
            authSection.style.display = 'block';
            locationSection.style.display = 'none';
            youtubeSection.style.display = 'none';
        }
    });

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            statusMessages.textContent = 'Initiating login...';
            chrome.runtime.sendMessage({ type: "LOGIN_KROGER" }, (response) => {
                if (chrome.runtime.lastError) {
                    statusMessages.textContent = `Error: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    statusMessages.textContent = `Error: ${response.error}`;
                } else if (response && response.success) {
                    statusMessages.textContent = "Login process started. Please complete in the new tab.";
                }
            });
        });
    }

    if (searchLocationsBtn) {
        searchLocationsBtn.addEventListener('click', () => {
            const zip = zipCodeInput.value.trim();
            const zipRegex = /^\d{5}$/;
            if (!zipRegex.test(zip)) {
                statusMessages.textContent = "Please enter a valid 5-digit ZIP code.";
                return;
            }
            statusMessages.textContent = `Searching locations for ${zip}...`;
            searchLocationsBtn.disabled = true;
            zipCodeInput.disabled = true;
            locationsListDiv.innerHTML = '';
            saveLocationBtn.style.display = 'none';
            selectedLocationId = null;

            chrome.runtime.sendMessage({ type: "SEARCH_KROGER_LOCATIONS", zipCode: zip }, (response) => {
                searchLocationsBtn.disabled = false;
                zipCodeInput.disabled = false;
                if (chrome.runtime.lastError) {
                    statusMessages.textContent = `Error searching locations: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    statusMessages.textContent = `Error searching locations: ${response.error}`;
                } else if (response && response.success && response.locations) {
                    statusMessages.textContent = response.locations.length > 0 ? `Found locations for ${zip}. Select one.` : `No locations found for ${zip}.`;
                    renderLocations(response.locations);
                }
            });
        });
    }

    function renderLocations(locations) {
        locationsListDiv.innerHTML = '';
        locations.forEach(location => {
            const locDiv = document.createElement('div');
            locDiv.textContent = `${location.name} (${location.address.addressLine1})`;
            locDiv.dataset.locationId = location.locationId;
            locDiv.addEventListener('click', () => {
                const currentlySelected = locationsListDiv.querySelector('.selected');
                if (currentlySelected) {
                    currentlySelected.classList.remove('selected');
                }
                locDiv.classList.add('selected');
                selectedLocationId = location.locationId;
                saveLocationBtn.style.display = 'block';
                statusMessages.textContent = `Selected: ${location.name}`;
            });
            locationsListDiv.appendChild(locDiv);
        });
    }

    if (saveLocationBtn) {
        saveLocationBtn.addEventListener('click', () => {
            if (!selectedLocationId) {
                statusMessages.textContent = "Please select a location first.";
                return;
            }
            statusMessages.textContent = "Saving location...";
            saveLocationBtn.disabled = true;

            chrome.runtime.sendMessage({ type: "SAVE_KROGER_LOCATION", locationId: selectedLocationId }, (response) => {
                saveLocationBtn.disabled = false;
                if (chrome.runtime.lastError) {
                    statusMessages.textContent = `Error saving location: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    statusMessages.textContent = `Error saving location: ${response.error}`;
                } else if (response && response.success) {
                    statusMessages.textContent = "Location saved successfully!";
                    locationSection.style.display = 'none';
                    youtubeSection.style.display = 'block';
                }
            });
        });
    }

    const analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
    const ingredientsSection = document.getElementById('ingredients-section');
    const ingredientsListUl = document.getElementById('ingredientsList');
    let currentIngredients = []; // Variable to store the latest ingredients
    const addToCartBtn = document.getElementById('addToCartBtn');


    if (analyzeVideoBtn) {
        analyzeVideoBtn.addEventListener('click', () => {
            statusMessages.textContent = "Analyzing video...";
            analyzeVideoBtn.disabled = true;
            ingredientsSection.style.display = 'none';
            ingredientsListUl.innerHTML = '';

            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (!tabs[0] || !tabs[0].id) {
                    statusMessages.textContent = "Cannot identify active tab.";
                    analyzeVideoBtn.disabled = false;
                    return;
                }
                if (tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_YOUTUBE_VIDEO_DETAILS" }, (videoDetails) => {
                        if (chrome.runtime.lastError) {
                            statusMessages.textContent = `Error getting video details: ${chrome.runtime.lastError.message}`;
                            analyzeVideoBtn.disabled = false;
                            return;
                        }
                        if (videoDetails) {
                            console.log("Popup: Received video details from content script:", videoDetails);
                            statusMessages.textContent = "Video details received. Analyzing for ingredients...";
                            chrome.runtime.sendMessage({ type: "ANALYZE_VIDEO_CONTENT", videoDetails: videoDetails }, (analysisResponse) => {
                                analyzeVideoBtn.disabled = false;
                                if (chrome.runtime.lastError) {
                                    statusMessages.textContent = `Analysis error: ${chrome.runtime.lastError.message}`;
                                } else if (analysisResponse && analysisResponse.error) {
                                    statusMessages.textContent = `Analysis error: ${analysisResponse.error}`;
                                } else if (analysisResponse && analysisResponse.success && analysisResponse.ingredients) {
                                    statusMessages.textContent = "Ingredients found!";
                                    renderIngredients(analysisResponse.ingredients);
                                } else {
                                    statusMessages.textContent = "No ingredients found or unexpected response from analysis.";
                                }
                            });
                        } else {
                            statusMessages.textContent = "Could not retrieve details from video page.";
                            analyzeVideoBtn.disabled = false;
                        }
                    });
                } else {
                    statusMessages.textContent = "Please navigate to a YouTube video page (youtube.com/watch?v=...).";
                    analyzeVideoBtn.disabled = false;
                }
            });
        });
    }

    function renderIngredients(ingredients) {
        ingredientsListUl.innerHTML = '';
        currentIngredients = []; // Reset before populating
        const addToCartBtnElement = document.getElementById('addToCartBtn'); // Get the button to show/hide

        if (ingredients && ingredients.length > 0) {
            ingredients.forEach(ingredient => {
                const li = document.createElement('li');
                // Assuming ingredient is a string. If it's an object, adjust accordingly.
                li.textContent = typeof ingredient === 'string' ? ingredient : ingredient.name;
                ingredientsListUl.appendChild(li);
                currentIngredients.push(ingredient); // Store for cart addition
            });
            if (addToCartBtnElement) addToCartBtnElement.style.display = 'block'; // Show cart button
        } else {
            const li = document.createElement('li');
            li.textContent = "No ingredients listed.";
            ingredientsListUl.appendChild(li);
            if (addToCartBtnElement) addToCartBtnElement.style.display = 'none'; // Hide cart button
        }
        // Ensure ingredientsSection itself is visible if it was hidden
        document.getElementById('ingredients-section').style.display = 'block';
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            if (!currentIngredients || currentIngredients.length === 0) {
                document.getElementById('status-messages').textContent = "No ingredients to add.";
                return;
            }

            document.getElementById('status-messages').textContent = "Adding ingredients to cart... This may take a moment.";
            addToCartBtn.disabled = true; // Disable button during operation

            // Send ingredients to background script for processing
            chrome.runtime.sendMessage({ type: "ADD_INGREDIENTS_TO_KROGER_CART", ingredients: currentIngredients }, (response) => {
                addToCartBtn.disabled = false; // Re-enable button
                if (chrome.runtime.lastError) {
                    document.getElementById('status-messages').textContent = `Error: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    document.getElementById('status-messages').textContent = `Error adding to cart: ${response.error}`;
                } else if (response && response.success) {
                    let successMessage = "Successfully added items to cart!";
                    if (response.summary) {
                        successMessage += ` Added: ${response.summary.added}, Skipped: ${response.summary.skipped} (Reason: ${response.summary.skippedReason || 'not found/error'}).`;
                        if(response.summary.errors > 0) {
                             successMessage += ` Errors: ${response.summary.errors}.`;
                        }
                    }
                    document.getElementById('status-messages').textContent = successMessage;
                } else {
                     document.getElementById('status-messages').textContent = "Unknown response after adding to cart.";
                }
            });
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const statusMessages = document.getElementById('status-messages');
    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');

    if (message.type === "AUTH_SUCCESS") {
        statusMessages.textContent = 'Login successful! Please set your location.';
        authSection.style.display = 'none';
        locationSection.style.display = 'block';
        youtubeSection.style.display = 'none';
    } else if (message.type === "AUTH_FAILURE") {
        statusMessages.textContent = `Login failed: ${message.error}`;
        authSection.style.display = 'block'; // Show login section again
        locationSection.style.display = 'none';
        youtubeSection.style.display = 'none';
    }
});
