document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup DOMContentLoaded: Initializing...");

    // Initial UI Reset
    const ingredientsListUl = document.getElementById('ingredientsList'); // Moved up
    const locationsListDiv = document.getElementById('locationsList'); // Moved up
    const statusMessages = document.getElementById('status-messages');

    ingredientsListUl.innerHTML = '';
    locationsListDiv.innerHTML = '';
    statusMessages.textContent = 'Checking status...'; // More specific initial message

    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const ingredientsSection = document.getElementById('ingredients-section'); // Added for completeness of hiding
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    const addToCartBtn = document.getElementById('addToCartBtn');

    // Hide all major sections initially, then show the correct one
    authSection.style.display = 'none';
    locationSection.style.display = 'none';
    youtubeSection.style.display = 'none';
    ingredientsSection.style.display = 'none';
    saveLocationBtn.style.display = 'none';
    addToCartBtn.style.display = 'none';

    // Moved currentIngredients declaration to be accessible by the storage callback
    // let currentIngredients = []; // This was inside analyzeVideoBtn logic, now moved higher if needed by initial display
    // For this subtask, currentIngredients being populated relies on analyzeVideoBtn click,
    // so it will be empty on initial load unless we store/retrieve it from chrome.storage as well.
    // The prompt suggests checking it, implying it might be populated. For now, assume it's an in-memory variable.

    const searchLocationsBtn = document.getElementById('searchLocationsBtn');
    const zipCodeInput = document.getElementById('zipCode');
    const locationsListDiv = document.getElementById('locationsList');
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    let selectedLocationId = null;

    // Check initial auth state and location state
    chrome.storage.local.get(['kroger_access_token', 'kroger_location_id', 'kroger_token_expires_in', 'kroger_token_obtained_at'], function(result) {
        console.log("Popup: Storage data retrieved:", result);

        const now = Date.now();
        let isValidToken = false;
        if (result.kroger_access_token && result.kroger_token_obtained_at && result.kroger_token_expires_in) {
            const tokenAge = now - result.kroger_token_obtained_at;
            const expiresInMs = result.kroger_token_expires_in * 1000;
            if (tokenAge < expiresInMs) {
                isValidToken = true;
            } else {
                console.log("Popup: Token expired.");
                // Optionally, clear expired token data from storage here
                // chrome.storage.local.remove(['kroger_access_token', 'kroger_refresh_token', 'kroger_token_expires_in', 'kroger_token_obtained_at', 'kroger_location_id']);
            }
        }

        console.log("Popup: Token valid?", isValidToken);
        console.log("Popup: Location ID from storage:", result.kroger_location_id);

        if (isValidToken) {
            authSection.style.display = 'none';
            if (result.kroger_location_id) {
                statusMessages.textContent = 'Ready to analyze or add to cart.';
                locationSection.style.display = 'none';
                // If currentIngredients (in-memory) has items, show ingredients view, else YouTube view.
                // This check for currentIngredients won't work as expected on a fresh popup load as it's not persisted.
                // For now, will default to youtubeSection as per original logic.
                // A more robust solution would store/retrieve currentIngredients via chrome.storage if persistence across popup closes is desired.
                // if (currentIngredients && currentIngredients.length > 0) { // currentIngredients is not defined here yet
                //      youtubeSection.style.display = 'none';
                //      ingredientsSection.style.display = 'block';
                //      addToCartBtn.style.display = 'block';
                // } else {
                youtubeSection.style.display = 'block';
                ingredientsSection.style.display = 'none';
                // }
                console.log("Popup: Logged in and location set. Showing YouTube section.");
            } else {
                statusMessages.textContent = 'Logged in. Please select your Kroger store.';
                locationSection.style.display = 'block';
                youtubeSection.style.display = 'none';
                ingredientsSection.style.display = 'none';
                console.log("Popup: Logged in, no location. Showing location section.");
            }
        } else {
            statusMessages.textContent = 'Please login with Kroger.';
            authSection.style.display = 'block';
            locationSection.style.display = 'none';
            youtubeSection.style.display = 'none';
            ingredientsSection.style.display = 'none';
            console.log("Popup: Not logged in or token expired. Showing auth section.");
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
    // Moved currentIngredients declaration higher
    let currentIngredients = [];
    const ingredientsSection = document.getElementById('ingredients-section');
    const ingredientsListUl = document.getElementById('ingredientsList');
    const addToCartBtn = document.getElementById('addToCartBtn'); // Already defined, ensure this is after its DOM element


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
    const ingredientsSection = document.getElementById('ingredients-section'); // Added

    if (message.type === "AUTH_SUCCESS") {
        statusMessages.textContent = 'Login successful! Please select your store.';
        authSection.style.display = 'none';
        locationSection.style.display = 'block'; // Show location section next
        youtubeSection.style.display = 'none';
        ingredientsSection.style.display = 'none'; // Ensure ingredients hidden
        console.log("Popup: Auth success, showing location section.");
    } else if (message.type === "AUTH_FAILURE") {
        statusMessages.textContent = `Login failed: ${message.error}`;
        authSection.style.display = 'block'; // Ensure auth section is visible for retry
        locationSection.style.display = 'none';
        youtubeSection.style.display = 'none';
        ingredientsSection.style.display = 'none'; // Ensure ingredients hidden
        console.log("Popup: Auth failure.");
    }
    // This was a proposed new message type, but existing logic in saveLocationBtn callback handles UI
    // else if (message.type === "LOCATION_SAVED_SUCCESS") {
    //      statusMessages.textContent = "Location saved! Ready to analyze.";
    //      locationSection.style.display = 'none';
    //      youtubeSection.style.display = 'block';
    //      ingredientsSection.style.display = 'none';
    //      console.log("Popup: Location saved, showing YouTube section.");
    // }
});
