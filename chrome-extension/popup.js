// In popup.js

// Ensure currentIngredients is declared in a scope accessible by DOMContentLoaded if needed by its logic.
// It was previously defined globally for the file.
let currentIngredients = []; 

document.addEventListener('DOMContentLoaded', function() {
    console.log("=======================================");
    console.log("Popup DOMContentLoaded: Initializing UI and State Checks...");
    console.log("=======================================");

    const ingredientsListUl = document.getElementById('ingredientsList');
    const locationsListDiv = document.getElementById('locationsList');
    const statusMessages = document.getElementById('status-messages');
    
    // Clear previous dynamic content
    if (ingredientsListUl) ingredientsListUl.innerHTML = '';
    if (locationsListDiv) locationsListDiv.innerHTML = '';
    if (statusMessages) statusMessages.textContent = 'Checking status...'; // More specific initial message

    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const ingredientsSection = document.getElementById('ingredients-section'); // Added for completeness of hiding
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const selectAllBtn = document.getElementById('selectAllBtn'); // New
    const deselectAllBtn = document.getElementById('deselectAllBtn'); // New
    const selectionControlsDiv = document.getElementById('selection-controls'); // New

    // Ensure all sections are hidden by default before logic decides which to show
    if (authSection) authSection.style.display = 'none';
    if (locationSection) locationSection.style.display = 'none';
    if (youtubeSection) youtubeSection.style.display = 'none';
    if (ingredientsSection) ingredientsSection.style.display = 'none';
    if (saveLocationBtn) saveLocationBtn.style.display = 'none';
    if (addToCartBtn) addToCartBtn.style.display = 'none';

    console.log("Popup DOMInit: All sections hidden initially. Fetching from storage...");

    chrome.storage.local.get(['kroger_access_token', 'kroger_location_id', 'kroger_token_expires_in', 'kroger_token_obtained_at'], function(result) {
        console.log("---------------------------------------");
        console.log("Popup Storage Callback: Data retrieved from chrome.storage.local:", result);
        console.log("---------------------------------------");

        const now = Date.now();
        let isValidToken = false;

        if (result.kroger_access_token && result.kroger_token_obtained_at && result.kroger_token_expires_in) {
            const tokenObtainedAt = result.kroger_token_obtained_at;
            const expiresInSeconds = result.kroger_token_expires_in;
            const tokenAgeMs = now - tokenObtainedAt;
            const expiresInMs = expiresInSeconds * 1000;
            
            console.log(`Popup Storage CB: Now = ${now}`);
            console.log(`Popup Storage CB: Token Obtained At = ${tokenObtainedAt}`);
            console.log(`Popup Storage CB: Expires In (seconds) = ${expiresInSeconds}`);
            console.log(`Popup Storage CB: Token Age (ms) = ${tokenAgeMs}`);
            console.log(`Popup Storage CB: Token Expires In (ms) = ${expiresInMs}`);

            if (tokenAgeMs < expiresInMs) {
                isValidToken = true;
                console.log("Popup Storage CB: Token IS VALID.");
            } else {
                isValidToken = false;
                console.log("Popup Storage CB: Token HAS EXPIRED.");
                // Optionally clear all stored Kroger data upon expiry
                // chrome.storage.local.remove(['kroger_access_token', 'kroger_refresh_token', 'kroger_token_expires_in', 'kroger_token_obtained_at', 'kroger_location_id']);
                // console.log("Popup Storage CB: Expired token and related data cleared from storage.");
            }
        } else {
            console.log("Popup Storage CB: Token data incomplete or missing from storage.");
            isValidToken = false;
        }
        
        console.log(`Popup Storage CB: Calculated isValidToken = ${isValidToken}`);
        const storedLocationId = result.kroger_location_id;
        console.log(`Popup Storage CB: Stored kroger_location_id = ${storedLocationId}`);

        if (isValidToken) {
            console.log("Popup Storage CB: Path chosen: Valid Token.");
            if (authSection) authSection.style.display = 'none';
            if (storedLocationId) {
                console.log("Popup Storage CB: Path chosen: Location ID Present.");
                if (statusMessages) statusMessages.textContent = 'Ready to analyze or add to cart.';
                if (locationSection) locationSection.style.display = 'none';
                
                // Logic for showing youtube vs ingredients section
                // currentIngredients is not persistent across popup closures unless stored in chrome.storage
                // So, typically, ingredientsSection won't show on initial load unless we implement that.
                console.log("Popup Storage CB: currentIngredients length on load:", currentIngredients.length);
                if (currentIngredients && currentIngredients.length > 0 && ingredientsSection && addToCartBtn) {
                     console.log("Popup Storage CB: Showing ingredients section (from previous analysis in this popup session).");
                     if (youtubeSection) youtubeSection.style.display = 'none';
                     ingredientsSection.style.display = 'block';
                     addToCartBtn.style.display = 'block';
                } else {
                    console.log("Popup Storage CB: Showing YouTube section.");
                    if (youtubeSection) youtubeSection.style.display = 'block';
                    if (ingredientsSection) ingredientsSection.style.display = 'none';
                }
            } else {
                console.log("Popup Storage CB: Path chosen: Location ID NOT Present.");
                if (statusMessages) statusMessages.textContent = 'Logged in. Please select your Kroger store.';
                if (locationSection) locationSection.style.display = 'block';
                if (youtubeSection) youtubeSection.style.display = 'none';
                if (ingredientsSection) ingredientsSection.style.display = 'none';
            }
        } else {
            console.log("Popup Storage CB: Path chosen: Invalid or No Token.");
            if (statusMessages) statusMessages.textContent = 'Please login with Kroger.';
            if (authSection) authSection.style.display = 'block';
            if (locationSection) locationSection.style.display = 'none';
            if (youtubeSection) youtubeSection.style.display = 'none';
            if (ingredientsSection) ingredientsSection.style.display = 'none';
        }
        console.log("---------------------------------------");
        console.log("Popup Storage CB: Final display styles set:");
        if (authSection) console.log(`Popup Storage CB: authSection.style.display = ${authSection.style.display}`);
        if (locationSection) console.log(`Popup Storage CB: locationSection.style.display = ${locationSection.style.display}`);
        if (youtubeSection) console.log(`Popup Storage CB: youtubeSection.style.display = ${youtubeSection.style.display}`);
        if (ingredientsSection) console.log(`Popup Storage CB: ingredientsSection.style.display = ${ingredientsSection.style.display}`);
        console.log("=======================================");
    });

    // Event listeners for buttons (loginBtn, searchLocationsBtn, etc.)
    // These ensure the DOM element variables are defined locally within this scope
    // or are accessible if defined outside this specific block but within DOMContentLoaded.
    
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (statusMessages) statusMessages.textContent = 'Initiating login...';
            chrome.runtime.sendMessage({ type: "LOGIN_KROGER" }, (response) => {
                if (chrome.runtime.lastError) {
                    if (statusMessages) statusMessages.textContent = `Error initiating login: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    if (statusMessages) statusMessages.textContent = `Error initiating login: ${response.error}`;
                } else if (response && response.success) {
                    if (statusMessages) statusMessages.textContent = "Login process started. Please complete in the new tab.";
                }
            });
        });
    }

    const searchLocationsBtn = document.getElementById('searchLocationsBtn');
    const zipCodeInput = document.getElementById('zipCode');
    // locationsListDiv is already defined above
    // saveLocationBtn is already defined above
    let selectedLocationId = null;

    if (searchLocationsBtn) {
        searchLocationsBtn.addEventListener('click', () => {
            const zip = zipCodeInput.value.trim();
            const zipRegex = /^\d{5}$/;
            if (!zipRegex.test(zip)) {
                if (statusMessages) statusMessages.textContent = "Please enter a valid 5-digit ZIP code.";
                return;
            }
            if (statusMessages) statusMessages.textContent = `Searching locations for ${zip}...`;
            searchLocationsBtn.disabled = true;
            zipCodeInput.disabled = true;
            if (locationsListDiv) locationsListDiv.innerHTML = ''; 
            if (saveLocationBtn) saveLocationBtn.style.display = 'none';
            selectedLocationId = null;

            chrome.runtime.sendMessage({ type: "SEARCH_KROGER_LOCATIONS", zipCode: zip }, (response) => {
                searchLocationsBtn.disabled = false;
                zipCodeInput.disabled = false;
                if (chrome.runtime.lastError) {
                    if (statusMessages) statusMessages.textContent = `Error searching locations: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    if (statusMessages) statusMessages.textContent = `Error searching locations: ${response.error}`;
                } else if (response && response.success && response.locations) {
                    if (statusMessages) statusMessages.textContent = response.locations.length > 0 ? `Found locations for ${zip}. Select one.` : `No locations found for ${zip}.`;
                    renderLocations(response.locations);
                }
            });
        });
    }

    function renderLocations(locations) {
        if (!locationsListDiv) return;
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
                if (saveLocationBtn) saveLocationBtn.style.display = 'block';
                if (statusMessages) statusMessages.textContent = `Selected: ${location.name}`;
            });
            locationsListDiv.appendChild(locDiv);
        });
    }

    if (saveLocationBtn) {
        saveLocationBtn.addEventListener('click', () => {
            if (!selectedLocationId) {
                if (statusMessages) statusMessages.textContent = "Please select a location first.";
                return;
            }
            if (statusMessages) statusMessages.textContent = "Saving location...";
            saveLocationBtn.disabled = true;

            chrome.runtime.sendMessage({ type: "SAVE_KROGER_LOCATION", locationId: selectedLocationId }, (response) => {
                saveLocationBtn.disabled = false;
                if (chrome.runtime.lastError) {
                    if (statusMessages) statusMessages.textContent = `Error saving location: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    if (statusMessages) statusMessages.textContent = `Error saving location: ${response.error}`;
                } else if (response && response.success) {
                    if (statusMessages) statusMessages.textContent = "Location saved successfully!";
                    if (locationSection) locationSection.style.display = 'none';
                    if (youtubeSection) youtubeSection.style.display = 'block'; 
                }
            });
        });
    }

    const analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
    // ingredientsSection, ingredientsListUl, addToCartBtn are already defined above.
    // currentIngredients is defined at the top of the script.

    // Visibility of selectionControlsDiv will be handled by renderIngredients or if it's inside ingredients-section
    if (selectionControlsDiv) selectionControlsDiv.style.display = 'none';


    if (analyzeVideoBtn) {
        analyzeVideoBtn.addEventListener('click', () => {
            if (statusMessages) statusMessages.textContent = "Analyzing video...";
            analyzeVideoBtn.disabled = true;
            if (ingredientsSection) ingredientsSection.style.display = 'none';
            if (ingredientsListUl) ingredientsListUl.innerHTML = '';

            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (!tabs[0] || !tabs[0].id) {
                    if (statusMessages) statusMessages.textContent = "Cannot identify active tab.";
                    analyzeVideoBtn.disabled = false;
                    return;
                }
                if (tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_YOUTUBE_VIDEO_DETAILS" }, (videoDetails) => {
                        if (chrome.runtime.lastError) {
                            if (statusMessages) statusMessages.textContent = `Error getting video details: ${chrome.runtime.lastError.message}`;
                            analyzeVideoBtn.disabled = false;
                            return;
                        }
                        if (videoDetails) {
                            console.log("Popup: Received video details from content script:", videoDetails);
                            if (statusMessages) statusMessages.textContent = "Video details received. Analyzing for ingredients...";
                            chrome.runtime.sendMessage({ type: "ANALYZE_VIDEO_CONTENT", videoDetails: videoDetails }, (analysisResponse) => {
                                analyzeVideoBtn.disabled = false;
                                if (chrome.runtime.lastError) {
                                    if (statusMessages) statusMessages.textContent = `Analysis error: ${chrome.runtime.lastError.message}`;
                                } else if (analysisResponse && analysisResponse.error) {
                                    if (statusMessages) statusMessages.textContent = `Analysis error: ${analysisResponse.error}`;
                                } else if (analysisResponse && analysisResponse.success && analysisResponse.ingredients) {
                                    if (statusMessages) statusMessages.textContent = "Ingredients found!";
                                    renderIngredients(analysisResponse.ingredients);
                                } else {
                                    if (statusMessages) statusMessages.textContent = "No ingredients found or unexpected response from analysis.";
                                }
                            });
                        } else {
                            if (statusMessages) statusMessages.textContent = "Could not retrieve details from video page.";
                            analyzeVideoBtn.disabled = false;
                        }
                    });
                } else {
                    if (statusMessages) statusMessages.textContent = "Please navigate to a YouTube video page (youtube.com/watch?v=...).";
                    analyzeVideoBtn.disabled = false;
                }
            });
        });
    }

    function renderIngredients(ingredients) {
        // const ingredientsListUl = document.getElementById('ingredientsList'); // Already defined globally in DOMContentLoaded
        // const addToCartBtn = document.getElementById('addToCartBtn'); // Already defined globally in DOMContentLoaded
        
        if (!ingredientsListUl || !addToCartBtn) { // Check if elements exist
            console.error("Required DOM elements for rendering ingredients are missing.");
            return;
        }

        ingredientsListUl.innerHTML = ''; // Clear previous list
        currentIngredients = []; // Reset and repopulate

        if (ingredients && ingredients.length > 0) {
            ingredients.forEach((ingredientData, index) => {
                const ingredientName = typeof ingredientData === 'string' ? ingredientData : ingredientData.name;

                if (!ingredientName || ingredientName.trim() === "") return; // Skip empty ingredient names

                const ingredientObj = {
                    id: `ingredient-${index}-${Date.now()}`, // Unique ID for the checkbox and label
                    name: ingredientName,
                    checked: true // Checked by default
                };
                currentIngredients.push(ingredientObj);

                const li = document.createElement('li');
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = ingredientObj.id;
                checkbox.value = ingredientName;
                checkbox.checked = ingredientObj.checked;
                checkbox.dataset.ingredientName = ingredientName; // Store name for easy access

                checkbox.addEventListener('change', (event) => {
                    const changedIngredient = currentIngredients.find(item => item.id === event.target.id);
                    if (changedIngredient) {
                        changedIngredient.checked = event.target.checked;
                        console.log("Updated currentIngredients:", currentIngredients); // For debugging
                    }
                });

                const label = document.createElement('label');
                label.htmlFor = ingredientObj.id;
                label.textContent = ingredientName;

                li.appendChild(checkbox);
                li.appendChild(label);
                ingredientsListUl.appendChild(li);
            });
            
            addToCartBtn.textContent = "Add Selected to Cart"; // Update button text
            addToCartBtn.style.display = 'block';
        } else {
            const li = document.createElement('li');
            li.textContent = "No ingredients listed.";
            ingredientsListUl.appendChild(li);
            addToCartBtn.style.display = 'none'; // Hide cart button
        }
        // Ensure ingredientsSection itself is visible if it was hidden
        if (ingredientsSection) ingredientsSection.style.display = 'block';
        
        // Show/hide selection controls based on ingredients presence
        if (ingredients && ingredients.length > 0) {
            if (selectionControlsDiv) selectionControlsDiv.style.display = 'block';
        } else {
            if (selectionControlsDiv) selectionControlsDiv.style.display = 'none';
        }
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            console.log("Select All clicked");
            const checkboxes = ingredientsListUl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            // Update the currentIngredients array
            currentIngredients.forEach(ingredient => ingredient.checked = true);
            console.log("Updated currentIngredients (all selected):", currentIngredients);
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            console.log("Deselect All clicked");
            const checkboxes = ingredientsListUl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            // Update the currentIngredients array
            currentIngredients.forEach(ingredient => ingredient.checked = false);
            console.log("Updated currentIngredients (all deselected):", currentIngredients);
        });
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            // Filter currentIngredients to get only those that are checked
            const selectedIngredients = currentIngredients
                .filter(ingredient => ingredient.checked)
                .map(ingredient => ingredient.name); // Send only the names

            if (!selectedIngredients || selectedIngredients.length === 0) {
                document.getElementById('status-messages').textContent = "No ingredients selected to add.";
                return;
            }
            
            document.getElementById('status-messages').textContent = "Adding selected ingredients to cart... This may take a moment.";
            addToCartBtn.disabled = true; // Disable button during operation

            // Send ONLY selected ingredients to background script for processing
            chrome.runtime.sendMessage({ type: "ADD_INGREDIENTS_TO_KROGER_CART", ingredients: selectedIngredients }, (response) => {
                addToCartBtn.disabled = false; // Re-enable button
                if (chrome.runtime.lastError) {
                    document.getElementById('status-messages').textContent = `Error: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    document.getElementById('status-messages').textContent = `Error adding to cart: ${response.error}`;
                } else if (response && response.success) {
                    let successMessage = "Successfully processed selected items for cart!";
                    if (response.summary) {
                        successMessage += ` Added: ${response.summary.added}, Skipped: ${response.summary.skipped} (Reason: ${response.summary.skippedReason || 'not found/error'}).`;
                        if(response.summary.errors > 0) {
                             successMessage += ` Errors: ${response.summary.errors}.`;
                        }
                    }
                    document.getElementById('status-messages').textContent = successMessage;
                    // Optionally, clear the ingredients list or currentIngredients after successful addition
                    // renderIngredients([]); // This would clear the list and currentIngredients
                } else {
                     document.getElementById('status-messages').textContent = "Unknown response after adding to cart.";
                }
            });
        });
    }
    // Ensure all DOM element variables are defined if used in listeners below
    // For example, loginBtn, searchLocationsBtn, zipCodeInput, locationsListDiv, 
    // saveLocationBtn, analyzeVideoBtn, ingredientsListUl, addToCartBtn
    // are already defined at the top of this DOMContentLoaded listener.
});

// Message listener from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // These DOM element gets might fail if popup is not open when message is received.
    // However, these messages (AUTH_SUCCESS, AUTH_FAILURE) are primarily to update an open popup.
    const statusMessages = document.getElementById('status-messages'); 
    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const ingredientsSection = document.getElementById('ingredients-section'); 

    console.log("Popup: Received message from background:", message);
    if (message.type === "AUTH_SUCCESS") {
        if (statusMessages) statusMessages.textContent = 'Login successful! Please select your store.';
        if (authSection) authSection.style.display = 'none';
        if (locationSection) locationSection.style.display = 'block'; 
        if (youtubeSection) youtubeSection.style.display = 'none';
        if (ingredientsSection) ingredientsSection.style.display = 'none'; 
        console.log("Popup: Auth success, showing location section.");
    } else if (message.type === "AUTH_FAILURE") {
        if (statusMessages) statusMessages.textContent = `Login failed: ${message.error}`;
        if (authSection) authSection.style.display = 'block'; 
        if (locationSection) locationSection.style.display = 'none';
        if (youtubeSection) youtubeSection.style.display = 'none';
        if (ingredientsSection) ingredientsSection.style.display = 'none'; 
        console.log("Popup: Auth failure.");
    }
});
