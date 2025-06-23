// In background.js
// ####################################################################################
// # IMPORTANT: REPLACE WITH YOUR ACTUAL KROGER CLIENT ID BEFORE RUNNING THE EXTENSION #
// # You can get this from your Kroger Developer Portal account.                       #
const KROGER_CLIENT_ID = "youcart-2432612430342445485a5a477273704a627733736250477a4632716b755065315637767a694b6766726662436642514c6b466e716e366b61376c34435477106669341475649"; // <--- REPLACE THIS!!!
// ####################################################################################
const BACKEND_URL = "http://localhost:8000"; // Or your actual backend URL

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LOGIN_KROGER") {
        console.log("Background: LOGIN_KROGER message received.");
        const krogerAuthUrl = `https://api.kroger.com/v1/connect/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${KROGER_CLIENT_ID}&` +
            `redirect_uri=${chrome.runtime.getURL("oauth_callback.html")}&` + // Use chrome.runtime.getURL for the extension page
            `scope=cart.basic:write product.compact&state=12345`; // Add a state parameter for security

        chrome.tabs.create({ url: krogerAuthUrl, active: true }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Error opening Kroger auth tab:", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: "Could not open login tab." });
                return;
            }
            console.log("Kroger auth tab opened:", tab);
            sendResponse({ success: true }); 
        });
        return true; // Indicates you wish to send a response asynchronously
    } 
    else if (message.type === "KROGER_CODE_RECEIVED") {
        console.log("Background: KROGER_CODE_RECEIVED", message);
        const { code, redirectUri } = message;

        fetch(`${BACKEND_URL}/auth/exchange_code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code, redirect_uri: redirectUri }) // Send the extension's redirect_uri
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.detail || `HTTP error! status: ${response.status}`) });
            }
            return response.json();
        })
        .then(tokenData => {
            console.log("Background: Tokens received from backend:", tokenData);
            chrome.storage.local.set({
                kroger_access_token: tokenData.access_token,
                kroger_refresh_token: tokenData.refresh_token,
                kroger_token_expires_in: tokenData.expires_in,
                kroger_token_obtained_at: Date.now()
            }, () => {
                console.log("Background: Tokens stored successfully.");
                // Notify popup of success
                chrome.runtime.sendMessage({ type: "AUTH_SUCCESS" });
                
                // Optionally, close the oauth_callback.html tab
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.remove(sender.tab.id);
                }
            });
        })
        .catch(error => {
            console.error("Background: Error exchanging code or storing tokens:", error);
            // Notify popup of failure
            chrome.runtime.sendMessage({ type: "AUTH_FAILURE", error: error.message });
        });
        return true; // For async response
    }
    else if (message.type === "SEARCH_KROGER_LOCATIONS") {
        console.log("Background: SEARCH_KROGER_LOCATIONS received for ZIP:", message.zipCode);
        chrome.storage.local.get(['kroger_access_token'], function(result) {
            if (!result.kroger_access_token) {
                sendResponse({ success: false, error: "Not authenticated." });
                return;
            }
            const accessToken = result.kroger_access_token;
            fetch(`${BACKEND_URL}/locations?zip_code=${message.zipCode}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                }
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.detail || `HTTP error! Status: ${response.status}`); });
                }
                return response.json();
            })
            .then(locations => { // Assuming backend returns the list of locations directly
                console.log("Background: Locations received from backend:", locations);
                sendResponse({ success: true, locations: locations });
            })
            .catch(error => {
                console.error("Background: Error fetching locations:", error);
                sendResponse({ success: false, error: error.message });
            });
        });
        return true; // Required for async sendResponse
    }
    else if (message.type === "ANALYZE_VIDEO_CONTENT") {
        console.log("Background: ANALYZE_VIDEO_CONTENT received", message.videoDetails);
        const { title, description, transcriptUrl, videoUrl } = message.videoDetails;

        // Payload for the backend, now directly using transcriptUrl
        const analysisPayload = {
            title: title,
            link: videoUrl, // Ensure this is the correct YouTube video URL
            description: description,
            transcript_url: transcriptUrl // Pass the URL directly
        };

        console.log("Background: Sending to backend /get_ingredients with payload:", analysisPayload);

        // Call backend's /get_ingredients
        // No need to fetch kroger_access_token here as /get_ingredients is not token-protected currently on the backend.
        // If it were, you would fetch it from chrome.storage.local first.
        fetch(`${BACKEND_URL}/get_ingredients`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
                // No Authorization header needed if /get_ingredients is public
            },
            body: JSON.stringify(analysisPayload)
        })
        .then(response => {
            if (!response.ok) {
                // Try to parse error detail from backend's JSON response
                return response.json().then(err => { 
                    // Prefer err.detail if available, otherwise construct a message
                    let errorMessage = "HTTP error! Status: " + response.status;
                    if (err && err.detail) {
                        errorMessage = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
                    }
                    throw new Error(errorMessage);
                }).catch(() => {
                    // Fallback if response.json() itself fails or err.detail is not good
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("Background: Ingredients from backend:", data);
            if (data.ingredients) {
                sendResponse({ success: true, ingredients: data.ingredients });
            } else {
                // This case implies the backend responded with 200 OK but 'ingredients' field was missing.
                throw new Error("Ingredients not found in backend response despite success status.");
            }
        })
        .catch(error => {
            console.error("Background: Error getting ingredients from backend:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Required for async sendResponse
    }
    else if (message.type === "ADD_INGREDIENTS_TO_KROGER_CART") {
        console.log("Background: ADD_INGREDIENTS_TO_KROGER_CART received with ingredients:", message.ingredients, "and locationId:", message.locationId);
        const ingredientsToAdd = message.ingredients;
        const locationIdFromPopup = message.locationId; // Get locationId from message

        if (!ingredientsToAdd || ingredientsToAdd.length === 0) {
            sendResponse({ success: false, error: "No ingredients provided." });
            return false; 
        }

        if (!locationIdFromPopup) { // Check if locationId was provided by popup
            sendResponse({ success: false, error: "Location ID not provided by popup for cart operation." });
            return false; 
        }

        // Only need the access token from storage now for this operation
        chrome.storage.local.get(['kroger_access_token'], async function(storageData) {
            if (!storageData.kroger_access_token) {
                sendResponse({ success: false, error: "User not authenticated (no access token)." });
                return; // Exit if no token
            }

            const accessToken = storageData.kroger_access_token;
            
            let addedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            let lastSkippedReason = "";

            // Process each ingredient sequentially
            for (const ingredient of ingredientsToAdd) {
                const ingredientName = typeof ingredient === 'string' ? ingredient : ingredient.name;
                try {
                    console.log(`Background: Processing ingredient '${ingredientName}' for location '${locationIdFromPopup}'`);
                    const response = await fetch(`${BACKEND_URL}/process_ingredient`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            ingredient: ingredientName, 
                            location_id: locationIdFromPopup // Pass the location_id from popup to backend
                        }) 
                    });

                    // Refined error and response handling
                    if (!response.ok) {
                        let errorDetail = `Failed to process ingredient '${ingredientName}'. Status: ${response.status}`;
                        try {
                            const errJson = await response.json();
                            // Backend now returns {status: "error", reason: ..., kroger_status_code: ...}
                            if (errJson && errJson.reason) {
                                errorDetail = errJson.reason;
                            } else if (errJson && errJson.detail) { // Fallback for other HTTPException details
                                errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
                            }
                        } catch (e) { /* Ignore if error response is not JSON */ }
                        
                        console.warn(`Processing '${ingredientName}': ${errorDetail}`);
                        // Use the status from backend if available, otherwise infer from HTTP status
                        // The backend /process_ingredient now returns JSON with status:"error" for Kroger errors.
                        let backendStatusFailed = false;
                        try {
                            const tempErrJson = await response.json(); // Re-parse or use stored if possible
                            if (tempErrJson.status === "error" || tempErrJson.status === "skipped") backendStatusFailed = true;
                        } catch(e) { /* ignore */ }

                        if (backendStatusFailed || response.status === 404 || (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes("not found")) ) {
                            skippedCount++;
                            lastSkippedReason = errorDetail || "product not found";
                        } else {
                            errorCount++;
                        }
                        continue; 
                    }

                    const result = await response.json(); // Expecting {status: "added/skipped/error", ...}
                    console.log(`Background: Processed '${ingredientName}', backend result:`, result);
                    if (result.status === "added") {
                        addedCount++;
                    } else if (result.status === "skipped") {
                        skippedCount++;
                        lastSkippedReason = result.reason || "skipped by backend";
                    } else if (result.status === "error") {
                        errorCount++;
                        lastSkippedReason = result.reason || "error from backend"; // Capture reason if provided
                    }
                     else {
                        console.warn("Unexpected status from /process_ingredient:", result);
                        errorCount++; 
                    }

                } catch (error) { // Catch network errors for the fetch itself
                    console.error(`Background: Network or other error processing ingredient '${ingredientName}':`, error);
                    errorCount++;
                    lastSkippedReason = error.message; // Capture general error message
                }
            }

            console.log(`Finished processing ingredients. Added: ${addedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
            sendResponse({ 
                success: true, 
                summary: { 
                    added: addedCount, 
                    skipped: skippedCount, 
                    errors: errorCount,
                    skippedReason: lastSkippedReason
                } 
            });
        });
        return true; // Required for async sendResponse
    }
    else if (message.type === "SAVE_KROGER_LOCATION") {
        console.log("Background: SAVE_KROGER_LOCATION received for ID:", message.locationId);
        chrome.storage.local.get(['kroger_access_token'], function(result) {
            if (!result.kroger_access_token) {
                sendResponse({ success: false, error: "Not authenticated." });
                return;
            }
            const accessToken = result.kroger_access_token;
            fetch(`${BACKEND_URL}/save-location`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ location_id: message.locationId })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.detail || `HTTP error! Status: ${response.status}`); });
                }
                return response.json();
            })
            .then(saveResponse => {
                console.log("Background: Save location response from backend:", saveResponse);
                if (saveResponse.message === "Location saved successfully") { // Or check for a specific success field
                    chrome.storage.local.set({ kroger_location_id: message.locationId }, () => {
                        console.log("Background: Location ID saved to storage.");
                        sendResponse({ success: true });
                    });
                } else {
                    throw new Error(saveResponse.message || "Failed to save location due to backend response.");
                }
            })
            .catch(error => {
                console.error("Background: Error saving location:", error);
                sendResponse({ success: false, error: error.message });
            });
        });
        return true; // Required for async sendResponse
    }
});
