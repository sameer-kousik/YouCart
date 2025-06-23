// In popup.js

let currentSelectedLocationId = null;
let currentSelectedLocationName = null;
let currentIngredients = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log("=======================================");
    console.log("Popup DOMContentLoaded: Initializing UI and State Checks...");
    console.log("=======================================");

    // DOM Elements
    const ingredientsListUl = document.getElementById('ingredientsList');
    const locationsDropdown = document.getElementById('locationsDropdown'); // Changed from locationsListDiv
    const statusMessages = document.getElementById('status-messages');
    
    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const ingredientsSection = document.getElementById('ingredients-section'); 
    const addToCartBtn = document.getElementById('addToCartBtn');
    const selectAllBtn = document.getElementById('selectAllBtn'); 
    const deselectAllBtn = document.getElementById('deselectAllBtn'); 
    const selectionControlsDiv = document.getElementById('selection-controls'); 
    const currentLocationDisplayDiv = document.getElementById('current-location-display');
    const selectedLocationNameSpan = document.getElementById('selectedLocationName');
    const cartResultsSection = document.getElementById('cart-results-section');
    const addedItemsListUl = document.getElementById('addedItemsList');
    const skippedItemsListUl = document.getElementById('skippedItemsList');
    const goToCartBtn = document.getElementById('goToCartBtn'); // New button


    // Initial UI State Function
    function setInitialUIState() {
        if (ingredientsListUl) ingredientsListUl.innerHTML = '';
        if (locationsDropdown) {
            locationsDropdown.innerHTML = ''; // Clear previous options
            locationsDropdown.style.display = 'none'; // Hide dropdown initially
            // Add a default, non-selectable option
            const defaultOption = document.createElement('option');
            defaultOption.textContent = "Select a store...";
            defaultOption.value = "";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            locationsDropdown.appendChild(defaultOption);
        }
        if (statusMessages) {
            statusMessages.textContent = 'Checking status...';
            statusMessages.className = 'status-info'; // Default class
        }

        if (authSection) authSection.style.display = 'none';
        if (locationSection) locationSection.style.display = 'none';
        if (youtubeSection) youtubeSection.style.display = 'none';
        if (ingredientsSection) ingredientsSection.style.display = 'none';
        if (addToCartBtn) addToCartBtn.style.display = 'none';
        if (selectionControlsDiv) selectionControlsDiv.style.display = 'none';
        if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';
        if (cartResultsSection) cartResultsSection.style.display = 'none';
        if (addedItemsListUl) addedItemsListUl.innerHTML = '';
        if (skippedItemsListUl) skippedItemsListUl.innerHTML = '';
        if (goToCartBtn) goToCartBtn.style.display = 'none'; // Hide Go to Cart button initially
    }

    setInitialUIState(); // Call the function to set initial states

    console.log("Popup DOMInit: All sections hidden initially. Fetching from storage...");

    // Storage Check and UI Update
    chrome.storage.local.get(
        ['kroger_access_token', 'kroger_token_expires_in', 'kroger_token_obtained_at', 'last_selected_kroger_location_id', 'last_selected_kroger_location_name'], 
        function(result) {
            console.log("Popup Storage Callback: Data retrieved:", result);
            const now = Date.now();
            let isValidToken = false;

            if (result.kroger_access_token && result.kroger_token_obtained_at && result.kroger_token_expires_in) {
                const tokenAgeMs = now - result.kroger_token_obtained_at;
                const expiresInMs = result.kroger_token_expires_in * 1000;
                isValidToken = tokenAgeMs < expiresInMs;
                console.log(`Popup Storage CB: Token is ${isValidToken ? 'VALID' : 'EXPIRED/INVALID'}.`);
            } else {
                console.log("Popup Storage CB: Token data incomplete.");
            }
            
            if (isValidToken) {
                console.log("Popup Storage CB: Valid Token Path.");
                if (authSection) authSection.style.display = 'none';
                if (locationSection) locationSection.style.display = 'block';

                if (result.last_selected_kroger_location_id) {
                    currentSelectedLocationId = result.last_selected_kroger_location_id;
                    currentSelectedLocationName = result.last_selected_kroger_location_name || "Previously Selected";
                    if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = currentSelectedLocationName;
                    if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'block';
                    if (statusMessages) {
                        statusMessages.textContent = 'Logged in. Store loaded. Ready to analyze.';
                        statusMessages.className = 'status-info';
                    }
                    if (youtubeSection) youtubeSection.style.display = 'block'; 
                } else {
                    if (statusMessages) {
                        statusMessages.textContent = 'Logged in. Please search and select your Kroger store.';
                        statusMessages.className = 'status-info';
                    }
                    if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none'; 
                    if (youtubeSection) youtubeSection.style.display = 'none'; 
                }
                
                // Logic for showing ingredients if they exist (e.g. popup closed and reopened)
                if (currentIngredients && currentIngredients.length > 0 && ingredientsSection && addToCartBtn) {
                     if (youtubeSection) youtubeSection.style.display = 'none'; 
                     ingredientsSection.style.display = 'block';
                     if (addToCartBtn) addToCartBtn.style.display = 'block'; 
                     if (selectionControlsDiv) selectionControlsDiv.style.display = 'block';
                } else if (!currentSelectedLocationId) { 
                    if (youtubeSection) youtubeSection.style.display = 'none';
                }

            } else { 
                console.log("Popup Storage CB: Invalid/No Token Path.");
                if (statusMessages) {
                     statusMessages.textContent = 'Please login with Kroger to get started.';
                     statusMessages.className = 'status-info';
                }
                if (authSection) authSection.style.display = 'block';
                // All other sections remain hidden as per setInitialUIState
            }
            console.log("Popup Storage CB: UI setup complete.");
        }
    );
    
    // Login Button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (statusMessages) {
                statusMessages.textContent = 'Initiating login...';
                statusMessages.className = 'status-info';
            }
            chrome.runtime.sendMessage({ type: "LOGIN_KROGER" }, (response) => {
                if (chrome.runtime.lastError) {
                    if (statusMessages) {
                        statusMessages.textContent = `Login Error: ${chrome.runtime.lastError.message}`;
                        statusMessages.className = 'status-error';
                    }
                } else if (response && response.error) {
                    if (statusMessages) {
                        statusMessages.textContent = `Login Error: ${response.error}`;
                        statusMessages.className = 'status-error';
                    }
                } else if (response && response.success) {
                    if (statusMessages) {
                        statusMessages.textContent = "Login process started. Please follow instructions in the new tab.";
                        statusMessages.className = 'status-info';
                    }
                }
            });
        });
    }

    // Location Search
    const searchLocationsBtn = document.getElementById('searchLocationsBtn');
    const zipCodeInput = document.getElementById('zipCode');

    if (searchLocationsBtn && zipCodeInput && locationsDropdown) {
        searchLocationsBtn.addEventListener('click', () => {
            const zip = zipCodeInput.value.trim();
            const zipRegex = /^\d{5}$/;
            if (!zipRegex.test(zip)) {
                if (statusMessages) {
                    statusMessages.textContent = "Please enter a valid 5-digit ZIP code.";
                    statusMessages.className = 'status-error';
                }
                return;
            }
            if (statusMessages) {
                statusMessages.textContent = `Searching for stores in ${zip}...`;
                statusMessages.className = 'status-info';
            }
            searchLocationsBtn.disabled = true;
            zipCodeInput.disabled = true;
            locationsDropdown.innerHTML = ''; // Clear previous options
            const defaultOption = document.createElement('option'); // Re-add default
            defaultOption.textContent = "Loading stores...";
            defaultOption.value = "";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            locationsDropdown.appendChild(defaultOption);
            locationsDropdown.style.display = 'none'; // Hide while loading

            chrome.runtime.sendMessage({ type: "SEARCH_KROGER_LOCATIONS", zipCode: zip }, (response) => {
                searchLocationsBtn.disabled = false;
                zipCodeInput.disabled = false;
                if (chrome.runtime.lastError) {
                    if (statusMessages) {
                        statusMessages.textContent = `Location Search Error: ${chrome.runtime.lastError.message}`;
                        statusMessages.className = 'status-error';
                    }
                    locationsDropdown.style.display = 'none';
                } else if (response && response.error) {
                    if (statusMessages) {
                        statusMessages.textContent = `Location Search Error: ${response.error}`;
                        statusMessages.className = 'status-error';
                    }
                    locationsDropdown.style.display = 'none';
                } else if (response && response.success && response.locations) {
                    if (statusMessages) {
                        statusMessages.textContent = response.locations.length > 0 ? `Found ${response.locations.length} stores. Select one below.` : `No stores found for ${zip}. Try another ZIP.`;
                        statusMessages.className = response.locations.length > 0 ? 'status-success' : 'status-info';
                    }
                    renderLocations(response.locations);
                    locationsDropdown.style.display = response.locations.length > 0 ? 'block' : 'none';
                }
            });
        });
    }

    // Render Locations in Dropdown
    function renderLocations(locations) {
        if (!locationsDropdown) return;
        locationsDropdown.innerHTML = ''; // Clear "Loading..." or previous results

        if (!locations || locations.length === 0) {
            const noResultsOption = document.createElement('option');
            noResultsOption.textContent = "No stores found";
            noResultsOption.value = "";
            noResultsOption.disabled = true;
            locationsDropdown.appendChild(noResultsOption);
            locationsDropdown.selectedIndex = 0; // Select this default
            return;
        }

        const selectPromptOption = document.createElement('option');
        selectPromptOption.textContent = "Select a store...";
        selectPromptOption.value = "";
        selectPromptOption.disabled = true;
        selectPromptOption.selected = true; // Default selected
        locationsDropdown.appendChild(selectPromptOption);

        locations.forEach(location => {
            const option = document.createElement('option');
            let displayName = location.name || location.locationId;
            if (location.address && location.address.addressLine1) {
                displayName = `${location.name} (${location.address.addressLine1})`;
            }
            option.value = location.locationId;
            option.textContent = displayName;
            option.dataset.locationName = displayName; // Store name for display
            locationsDropdown.appendChild(option);
        });
        locationsDropdown.style.display = 'block';
    }

    // Location Dropdown Change Listener
    if (locationsDropdown) {
        locationsDropdown.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (!selectedOption || !selectedOption.value) { // Handle the prompt/disabled option
                currentSelectedLocationId = null;
                currentSelectedLocationName = null;
                if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = "None selected";
                if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';
                if (youtubeSection) youtubeSection.style.display = 'none';
                return;
            }

            currentSelectedLocationId = selectedOption.value;
            currentSelectedLocationName = selectedOption.dataset.locationName || selectedOption.textContent;

            if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = currentSelectedLocationName;
            if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'block';
            if (statusMessages) {
                statusMessages.textContent = `Store Selected: ${currentSelectedLocationName}`;
                statusMessages.className = 'status-success';
            }

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
            // Hide cart results if a new location is chosen after a cart operation
            if (cartResultsSection) cartResultsSection.style.display = 'none';
        });
    }

    // Analyze Video Button
    const analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
    if (analyzeVideoBtn) {
        analyzeVideoBtn.addEventListener('click', () => {
            if (statusMessages) {
                statusMessages.textContent = "Requesting video details...";
                statusMessages.className = 'status-info';
            }
            analyzeVideoBtn.disabled = true;
            if (ingredientsSection) ingredientsSection.style.display = 'none';
            if (ingredientsListUl) ingredientsListUl.innerHTML = '';
            if (cartResultsSection) cartResultsSection.style.display = 'none'; // Hide old results

            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (!tabs[0] || !tabs[0].id) {
                    if (statusMessages) {
                        statusMessages.textContent = "Error: Cannot identify active tab.";
                        statusMessages.className = 'status-error';
                    }
                    analyzeVideoBtn.disabled = false;
                    return;
                }
                if (tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_YOUTUBE_VIDEO_DETAILS" }, (videoDetails) => {
                        if (chrome.runtime.lastError) {
                            if (statusMessages) {
                                statusMessages.textContent = `Video Details Error: ${chrome.runtime.lastError.message}`;
                                statusMessages.className = 'status-error';
                            }
                            analyzeVideoBtn.disabled = false;
                            return;
                        }
                        if (videoDetails) {
                            if (statusMessages) {
                                statusMessages.textContent = "Analyzing video for ingredients...";
                                statusMessages.className = 'status-info';
                            }
                            chrome.runtime.sendMessage({ type: "ANALYZE_VIDEO_CONTENT", videoDetails: videoDetails }, (analysisResponse) => {
                                analyzeVideoBtn.disabled = false;
                                if (chrome.runtime.lastError) {
                                    if (statusMessages) {
                                        statusMessages.textContent = `Analysis Error: ${chrome.runtime.lastError.message}`;
                                        statusMessages.className = 'status-error';
                                    }
                                } else if (analysisResponse && analysisResponse.error) {
                                    if (statusMessages) {
                                        statusMessages.textContent = `Analysis Error: ${analysisResponse.error}`;
                                        statusMessages.className = 'status-error';
                                    }
                                } else if (analysisResponse && analysisResponse.success && analysisResponse.ingredients) {
                                    if (statusMessages) {
                                        statusMessages.textContent = "Ingredients found! Review and add to cart.";
                                        statusMessages.className = 'status-success';
                                    }
                                    renderIngredients(analysisResponse.ingredients);
                                    if (youtubeSection) youtubeSection.style.display = 'none'; // Hide analyze button, show ingredients
                                } else {
                                    if (statusMessages) {
                                        statusMessages.textContent = "No ingredients found or analysis failed.";
                                        statusMessages.className = 'status-info';
                                    }
                                    if (youtubeSection) youtubeSection.style.display = 'block'; // Show analyze button again
                                }
                            });
                        } else {
                            if (statusMessages) {
                                statusMessages.textContent = "Could not retrieve details from the video page.";
                                statusMessages.className = 'status-error';
                            }
                            analyzeVideoBtn.disabled = false;
                        }
                    });
                } else {
                    if (statusMessages) {
                        statusMessages.textContent = "Please navigate to a YouTube video page (youtube.com/watch?v=...).";
                        statusMessages.className = 'status-error';
                    }
                    analyzeVideoBtn.disabled = false;
                }
            });
        });
    }

    // Render Ingredients
    function renderIngredients(ingredients) {
        if (!ingredientsListUl || !addToCartBtn || !ingredientsSection || !selectionControlsDiv) return;
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
                checkbox.dataset.ingredientName = ingredientName; // Keep for consistency if needed
                checkbox.addEventListener('change', (event) => {
                    const changedIngredient = currentIngredients.find(item => item.id === event.target.id);
                    if (changedIngredient) changedIngredient.checked = event.target.checked;
                });
                const label = document.createElement('label');
                label.htmlFor = ingredientObj.id;
                label.textContent = ingredientName;
                li.appendChild(checkbox);
                li.appendChild(label);
                ingredientsListUl.appendChild(li);
            });
            addToCartBtn.style.display = 'block';
            selectionControlsDiv.style.display = 'block';
        } else {
            const li = document.createElement('li');
            li.textContent = "No ingredients were identified.";
            ingredientsListUl.appendChild(li);
            addToCartBtn.style.display = 'none'; 
            selectionControlsDiv.style.display = 'none';
        }
        ingredientsSection.style.display = 'block';
    }

    // Select/Deselect All Buttons
    if (selectAllBtn && ingredientsListUl) {
        selectAllBtn.addEventListener('click', () => {
            ingredientsListUl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            currentIngredients.forEach(ing => ing.checked = true);
        });
    }
    if (deselectAllBtn && ingredientsListUl) {
        deselectAllBtn.addEventListener('click', () => {
            ingredientsListUl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            currentIngredients.forEach(ing => ing.checked = false);
        });
    }

    // Add to Cart Button
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            const selectedIngredients = currentIngredients
                .filter(ingredient => ingredient.checked)
                .map(ingredient => ingredient.name);

            if (!currentSelectedLocationId) { 
                if (statusMessages) {
                    statusMessages.textContent = "Please select a Kroger store location first!";
                    statusMessages.className = 'status-error';
                }
                return;
            }
            if (!selectedIngredients || selectedIngredients.length === 0) {
                if (statusMessages) {
                    statusMessages.textContent = "No ingredients selected to add.";
                    statusMessages.className = 'status-info';
                }
                return;
            }
            
            if (statusMessages) {
                statusMessages.textContent = "Adding to cart... This might take a moment.";
                statusMessages.className = 'status-info';
            }
            addToCartBtn.disabled = true; 
            if (cartResultsSection) cartResultsSection.style.display = 'none';
            if (addedItemsListUl) addedItemsListUl.innerHTML = '';
            if (skippedItemsListUl) skippedItemsListUl.innerHTML = '';
            if (goToCartBtn) goToCartBtn.style.display = 'none'; // Ensure it's hidden before new results


            chrome.runtime.sendMessage({ 
                type: "ADD_INGREDIENTS_TO_KROGER_CART", 
                ingredients: selectedIngredients,
                locationId: currentSelectedLocationId
            }, (response) => {
                addToCartBtn.disabled = false; 
                if (chrome.runtime.lastError) {
                    if (statusMessages) {
                        statusMessages.textContent = `Cart Error: ${chrome.runtime.lastError.message}`;
                        statusMessages.className = 'status-error';
                    }
                } else if (response && response.error) {
                    if (statusMessages) {
                        statusMessages.textContent = `Cart Error: ${response.error}`;
                        statusMessages.className = 'status-error';
                    }
                } else if (response && response.success) {
                    let msgText = "Cart operation complete.";
                    if (response.summary) {
                        msgText = `Added ${response.summary.added_items.length} items, ${response.summary.skipped_items.length} skipped. See details below.`;
                        renderCartResults(response.summary.added_items, response.summary.skipped_items);
                        if (cartResultsSection) cartResultsSection.style.display = 'block';
                        if (goToCartBtn) goToCartBtn.style.display = 'block'; // Show Go to Cart button
                    } else {
                        // Handle cases where summary might be missing, though ideally it's always there on success
                        msgText = "Cart operation processed. Check results below.";
                        if (cartResultsSection) cartResultsSection.style.display = 'block'; // Still show section for empty lists
                        if (goToCartBtn) goToCartBtn.style.display = 'block';
                    }
                    if (statusMessages) {
                        statusMessages.textContent = msgText;
                        statusMessages.className = 'status-success';
                    }
                } else { // Handles response.error or other issues
                     if (statusMessages) {
                        statusMessages.textContent = "Unknown response or error after adding to cart.";
                        statusMessages.className = 'status-error';
                     }
                     // Optionally show cart results section with error message if needed
                     // renderCartResults([], []); // Clear lists or show error in lists
                     // if (cartResultsSection) cartResultsSection.style.display = 'block';
                }
            });
        });
    }

    // Render Cart Results - Ensures item names are displayed clearly.
    function renderCartResults(addedItems, skippedItems) {
        if (!addedItemsListUl || !skippedItemsListUl) return;
        addedItemsListUl.innerHTML = ''; // Clear previous results
        skippedItemsListUl.innerHTML = ''; // Clear previous results

        if (addedItems && addedItems.length > 0) {
            addedItems.forEach(item => {
                const li = document.createElement('li');
                // Ensure 'item.name' if item is an object, or item itself if string
                const itemName = (typeof item === 'object' && item !== null && item.name) ? item.name : item;
                li.textContent = itemName;
                li.className = 'added-item';
                addedItemsListUl.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = "No items were added to the cart.";
            li.style.fontStyle = "italic";
            addedItemsListUl.appendChild(li);
        }

        if (skippedItems && skippedItems.length > 0) {
            skippedItems.forEach(item => {
                const li = document.createElement('li');
                // Ensure 'item.name' if item is an object
                const itemName = (typeof item === 'object' && item !== null && item.name) ? item.name : item;
                let reason = (typeof item === 'object' && item !== null && item.reason) ? item.reason : 'Not found or error';

                li.textContent = `${itemName}`;
                li.className = 'skipped-item';

                const reasonSpan = document.createElement('span');
                reasonSpan.className = 'skipped-reason';
                reasonSpan.textContent = ` (${reason})`;
                li.appendChild(reasonSpan);
                skippedItemsListUl.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = "No items were skipped.";
            li.style.fontStyle = "italic";
            skippedItemsListUl.appendChild(li);
        }
    }

    // Go to Cart Button Listener
    if (goToCartBtn) {
        goToCartBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://www.kroger.com/cart' });
        });
    }

});

// Message listener from background script (for Auth updates)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const statusMessages = document.getElementById('status-messages'); 
    const authSection = document.getElementById('auth-section');
    const locationSection = document.getElementById('location-section');
    const youtubeSection = document.getElementById('youtube-section');
    const currentLocationDisplayDiv = document.getElementById('current-location-display');
    const selectedLocationNameSpan = document.getElementById('selectedLocationName');

    console.log("Popup: Received message from background:", message);
    if (message.type === "AUTH_SUCCESS") {
        if (statusMessages) {
            statusMessages.textContent = 'Login successful! Please select your store if not already set.';
            statusMessages.className = 'status-success';
        }
        if (authSection) authSection.style.display = 'none';
        if (locationSection) locationSection.style.display = 'block'; 
        // Don't hide youtube section immediately, let storage check handle it
        
        chrome.storage.local.get(['last_selected_kroger_location_id', 'last_selected_kroger_location_name'], function(result) {
            if (result.last_selected_kroger_location_id) {
                currentSelectedLocationId = result.last_selected_kroger_location_id;
                currentSelectedLocationName = result.last_selected_kroger_location_name || "Previously Selected";
                if (selectedLocationNameSpan) selectedLocationNameSpan.textContent = currentSelectedLocationName;
                if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'block';
                if (youtubeSection) youtubeSection.style.display = 'block';
            } else {
                // User needs to select a location
                if (youtubeSection) youtubeSection.style.display = 'none';
            }
        });
        console.log("Popup: Auth success, UI updated.");

    } else if (message.type === "AUTH_FAILURE") {
        if (statusMessages) {
            statusMessages.textContent = `Login failed: ${message.error || 'Unknown error'}`;
            statusMessages.className = 'status-error';
        }
        if (authSection) authSection.style.display = 'block'; 
        if (locationSection) locationSection.style.display = 'none';
        if (youtubeSection) youtubeSection.style.display = 'none';
        if (currentLocationDisplayDiv) currentLocationDisplayDiv.style.display = 'none';
        console.log("Popup: Auth failure.");
    }
});
