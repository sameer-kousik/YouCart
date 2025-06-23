// In popup.js

let currentSelectedLocationId = null; // Added file-global
let currentSelectedLocationName = null; // Added file-global
let currentIngredients = []; // File-global

document.addEventListener('DOMContentLoaded', function() {
    console.log("=======================================");
    console.log("Popup DOMContentLoaded: Initializing UI and State Checks...");
    console.log("=======================================");

    const ingredientsListUl = document.getElementById('ingredientsList');
    const locationsListDiv = document.getElementById('locationsList');
    const statusMessages = document.getElementById('status-messages');
    
    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const ingredientsSection = document.getElementById('ingredients-section'); 
    const saveLocationBtn = document.getElementById('saveLocationBtn'); // Will be unused
    const addToCartBtn = document.getElementById('addToCartBtn');
    const selectAllBtn = document.getElementById('selectAllBtn'); 
    const deselectAllBtn = document.getElementById('deselectAllBtn'); 
    const selectionControlsDiv = document.getElementById('selection-controls'); 
    const currentLocationDisplayDiv = document.getElementById('current-location-display'); // New
    const selectedLocationNameSpan = document.getElementById('selectedLocationName'); // New


    // Clear previous dynamic content & set initial states
    if (ingredientsListUl) ingredientsListUl.innerHTML = '';
    if (locationsListDiv) locationsListDiv.innerHTML = '';
    if (statusMessages) statusMessages.textContent = 'Checking status...'; 

    if (authSection) authSection.style.display = 'none';
    if (locationSection) locationSection.style.display = 'none';
    if (youtubeSection) youtubeSection.style.display = 'none';
    if (ingredientsSection) ingredientsSection.style.display = 'none';
    if (saveLocationBtn) saveLocationBtn.style.display = 'none'; // Hide old save button
    if (addToCartBtn) addToCartBtn.style.display = 'none';
    if (selectionControlsDiv) selectionControlsDiv.style.display = 'none';
    if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';


    console.log("Popup DOMInit: All sections hidden initially. Fetching from storage...");

    chrome.storage.local.get(
        ['kroger_access_token', 'kroger_token_expires_in', 'kroger_token_obtained_at', 'last_selected_kroger_location_id', 'last_selected_kroger_location_name'], 
        function(result) {
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
                }
            } else {
                console.log("Popup Storage CB: Token data incomplete or missing from storage.");
                isValidToken = false;
            }
            
            console.log(`Popup Storage CB: Calculated isValidToken = ${isValidToken}`);
            console.log("Popup Storage CB: last_selected_kroger_location_id:", result.last_selected_kroger_location_id);
            console.log("Popup Storage CB: last_selected_kroger_location_name:", result.last_selected_kroger_location_name);

            if (isValidToken) {
                console.log("Popup Storage CB: Path chosen: Valid Token.");
                if (authSection) authSection.style.display = 'none';
                if (locationSection) locationSection.style.display = 'block'; // Location section always available if logged in

                if (result.last_selected_kroger_location_id) {
                    currentSelectedLocationId = result.last_selected_kroger_location_id;
                    currentSelectedLocationName = result.last_selected_kroger_location_name || "Previously Selected";
                    if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = currentSelectedLocationName;
                    if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'block';
                    if (statusMessages) statusMessages.textContent = 'Logged in. Location loaded. Ready to analyze.';
                    if (youtubeSection) youtubeSection.style.display = 'block'; 
                    console.log("Popup Storage CB: Location loaded from storage. Showing YouTube section.");
                } else {
                    if (statusMessages) statusMessages.textContent = 'Logged in. Please select your Kroger store.';
                    if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none'; 
                    if (youtubeSection) youtubeSection.style.display = 'none'; 
                    console.log("Popup Storage CB: No location loaded from storage. User needs to select one.");
                }
                
                if (currentIngredients && currentIngredients.length > 0 && ingredientsSection && addToCartBtn) {
                     console.log("Popup Storage CB: Showing ingredients section (from previous analysis in this popup session).");
                     if (youtubeSection) youtubeSection.style.display = 'none'; 
                     ingredientsSection.style.display = 'block';
                     if (addToCartBtn) addToCartBtn.style.display = 'block'; 
                     if (selectionControlsDiv) selectionControlsDiv.style.display = 'block';
                } else if (!currentSelectedLocationId) { 
                    if (youtubeSection) youtubeSection.style.display = 'none';
                }

            } else { 
                console.log("Popup Storage CB: Path chosen: Invalid or No Token.");
                if (statusMessages) statusMessages.textContent = 'Please login with Kroger.';
                if (authSection) authSection.style.display = 'block';
                if (locationSection) locationSection.style.display = 'none';
                if (youtubeSection) youtubeSection.style.display = 'none';
                if (ingredientsSection) ingredientsSection.style.display = 'none';
                if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';
            }
            console.log("---------------------------------------");
            console.log("Popup Storage CB: Final display styles set:");
            if (authSection) console.log(`Popup Storage CB: authSection.style.display = ${authSection.style.display}`);
            if (locationSection) console.log(`Popup Storage CB: locationSection.style.display = ${locationSection.style.display}`);
            if (youtubeSection) console.log(`Popup Storage CB: youtubeSection.style.display = ${youtubeSection.style.display}`);
            if (ingredientsSection) console.log(`Popup Storage CB: ingredientsSection.style.display = ${ingredientsSection.style.display}`);
            console.log("=======================================");
        }
    );
    
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
    let selectedLocationId = null; // This was re-declared, now uses file-global currentSelectedLocationId

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
            // if (saveLocationBtn) saveLocationBtn.style.display = 'none'; // saveLocationBtn is no longer used for backend save
            currentSelectedLocationId = null; // Reset global
            currentSelectedLocationName = null; // Reset global
            if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = "None selected";
            if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';


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
        // const currentLocationDisplayDiv, selectedLocationNameSpan, youtubeSection, statusMessages defined above
        if (!locationsListDiv) return;
        locationsListDiv.innerHTML = ''; 

        locations.forEach(location => {
            const locDiv = document.createElement('div');
            let displayName = location.name || location.locationId;
            if (location.address && location.address.addressLine1) {
                displayName = `${location.name} (${location.address.addressLine1})`;
            }

            locDiv.textContent = displayName;
            locDiv.dataset.locationId = location.locationId;
            locDiv.dataset.locationName = displayName; 

            locDiv.addEventListener('click', () => {
                const previouslySelected = locationsListDiv.querySelector('.selected');
                if (previouslySelected) {
                    previouslySelected.classList.remove('selected');
                }
                locDiv.classList.add('selected');
                
                currentSelectedLocationId = locDiv.dataset.locationId;
                currentSelectedLocationName = locDiv.dataset.locationName;

                if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = currentSelectedLocationName;
                if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'block';
                if (statusMessages) statusMessages.textContent = `Selected Store: ${currentSelectedLocationName}`;
                
                chrome.storage.local.set({ 
                    last_selected_kroger_location_id: currentSelectedLocationId,
                    last_selected_kroger_location_name: currentSelectedLocationName 
                }, () => {
                    console.log("Popup: Last selected location saved to storage.");
                });

                if (youtubeSection) youtubeSection.style.display = 'block';
                if (ingredientsSection && ingredientsSection.style.display === 'block' && currentIngredients && currentIngredients.length > 0) {
                     if (youtubeSection) youtubeSection.style.display = 'none'; 
                }
            });
            locationsListDiv.appendChild(locDiv);
        });
    }

    if (saveLocationBtn) { 
      saveLocationBtn.style.display = 'none'; 
    }


    const analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
    // currentIngredients, ingredientsSection, ingredientsListUl, addToCartBtn defined above
    
    if (selectionControlsDiv) selectionControlsDiv.style.display = 'none'; // Initial hide for selection controls

    if (analyzeVideoBtn) {
        analyzeVideoBtn.addEventListener('click', () => {
            // ... (analyzeVideoBtn logic remains mostly the same as previous step)
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
        if (!ingredientsListUl || !addToCartBtn || !ingredientsSection || !selectionControlsDiv) {
            console.error("Required DOM elements for rendering ingredients are missing.");
            return;
        }
        ingredientsListUl.innerHTML = ''; 
        currentIngredients = []; 

        if (ingredients && ingredients.length > 0) {
            ingredients.forEach((ingredientData, index) => {
                const ingredientName = typeof ingredientData === 'string' ? ingredientData : ingredientData.name;
                if (!ingredientName || ingredientName.trim() === "") return; 
                const ingredientObj = {
                    id: `ingredient-${index}-${Date.now()}`, 
                    name: ingredientName,
                    checked: true 
                };
                currentIngredients.push(ingredientObj);
                const li = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = ingredientObj.id;
                checkbox.value = ingredientName;
                checkbox.checked = ingredientObj.checked;
                checkbox.dataset.ingredientName = ingredientName;
                checkbox.addEventListener('change', (event) => {
                    const changedIngredient = currentIngredients.find(item => item.id === event.target.id);
                    if (changedIngredient) {
                        changedIngredient.checked = event.target.checked;
                        console.log("Updated currentIngredients:", currentIngredients);
                    }
                });
                const label = document.createElement('label');
                label.htmlFor = ingredientObj.id;
                label.textContent = ingredientName;
                li.appendChild(checkbox);
                li.appendChild(label);
                ingredientsListUl.appendChild(li);
            });
            addToCartBtn.textContent = "Add Selected to Cart"; 
            addToCartBtn.style.display = 'block';
            selectionControlsDiv.style.display = 'block';
        } else {
            const li = document.createElement('li');
            li.textContent = "No ingredients listed.";
            ingredientsListUl.appendChild(li);
            addToCartBtn.style.display = 'none'; 
            selectionControlsDiv.style.display = 'none';
        }
        ingredientsSection.style.display = 'block';
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            console.log("Select All clicked");
            const checkboxes = ingredientsListUl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => { checkbox.checked = true; });
            currentIngredients.forEach(ingredient => ingredient.checked = true);
            console.log("Updated currentIngredients (all selected):", currentIngredients);
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            console.log("Deselect All clicked");
            const checkboxes = ingredientsListUl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => { checkbox.checked = false; });
            currentIngredients.forEach(ingredient => ingredient.checked = false);
            console.log("Updated currentIngredients (all deselected):", currentIngredients);
        });
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            const selectedIngredients = currentIngredients
                .filter(ingredient => ingredient.checked)
                .map(ingredient => ingredient.name);

            if (!currentSelectedLocationId) { 
                if (statusMessages) statusMessages.textContent = "Please select a Kroger store location first!";
                return;
            }
            if (!selectedIngredients || selectedIngredients.length === 0) {
                if (statusMessages) statusMessages.textContent = "No ingredients selected to add.";
                return;
            }
            
            if (statusMessages) statusMessages.textContent = "Adding selected ingredients to cart... This may take a moment.";
            addToCartBtn.disabled = true; 

            chrome.runtime.sendMessage({ 
                type: "ADD_INGREDIENTS_TO_KROGER_CART", 
                ingredients: selectedIngredients,
                locationId: currentSelectedLocationId // Pass selected location ID
            }, (response) => {
                addToCartBtn.disabled = false; 
                if (chrome.runtime.lastError) {
                    if (statusMessages) statusMessages.textContent = `Error adding to cart: ${chrome.runtime.lastError.message}`;
                } else if (response && response.error) {
                    if (statusMessages) statusMessages.textContent = `Error adding to cart: ${response.error}`;
                } else if (response && response.success) {
                    let successMessage = "Successfully processed selected items for cart!";
                    if (response.summary) {
                        successMessage += ` Added: ${response.summary.added}, Skipped: ${response.summary.skipped} (Reason: ${response.summary.skippedReason || 'not found/error'}).`;
                        if(response.summary.errors > 0) {
                             successMessage += ` Errors: ${response.summary.errors}.`;
                        }
                    }
                    if (statusMessages) statusMessages.textContent = successMessage;
                } else {
                     if (statusMessages) statusMessages.textContent = "Unknown response after adding to cart.";
                }
            });
        });
    }
});

// Message listener from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const statusMessages = document.getElementById('status-messages'); 
    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const ingredientsSection = document.getElementById('ingredients-section'); 
    const currentLocationDisplayDiv = document.getElementById('current-location-display'); // Added
    const selectedLocationNameSpan = document.getElementById('selectedLocationName'); // Added


    console.log("Popup: Received message from background:", message);
    if (message.type === "AUTH_SUCCESS") {
        if (statusMessages) statusMessages.textContent = 'Login successful! Please select your store.';
        if (authSection) authSection.style.display = 'none';
        if (locationSection) locationSection.style.display = 'block'; 
        if (youtubeSection) youtubeSection.style.display = 'none';
        if (ingredientsSection) ingredientsSection.style.display = 'none'; 
        
        chrome.storage.local.get(['last_selected_kroger_location_id', 'last_selected_kroger_location_name'], function(result) {
            if (result.last_selected_kroger_location_id) {
                currentSelectedLocationId = result.last_selected_kroger_location_id;
                currentSelectedLocationName = result.last_selected_kroger_location_name || "Previously Selected";
                if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = currentSelectedLocationName;
                if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'block';
                if (statusMessages) statusMessages.textContent = 'Logged in. Location loaded. Ready to analyze.';
                if (youtubeSection) youtubeSection.style.display = 'block';
            } else {
                if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';
                if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = "None selected";
                if (youtubeSection) youtubeSection.style.display = 'none';
            }
        });
        console.log("Popup: Auth success, UI updated for location selection or loaded location.");

    } else if (message.type === "AUTH_FAILURE") {
        if (statusMessages) statusMessages.textContent = `Login failed: ${message.error}`;
        if (authSection) authSection.style.display = 'block'; 
        if (locationSection) locationSection.style.display = 'none';
        if (youtubeSection) youtubeSection.style.display = 'none';
        if (ingredientsSection) ingredientsSection.style.display = 'none'; 
        if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';
        console.log("Popup: Auth failure.");
    }
});
