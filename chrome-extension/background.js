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

        // Step 1: Fetch the actual transcript XML if URL is provided
        let transcriptPromise;
        if (transcriptUrl && transcriptUrl.startsWith("http")) {
            transcriptPromise = fetch(transcriptUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch transcript XML: ${response.statusText}`);
                    return response.text();
                })
                .then(xmlText => {
                    // Basic XML parsing to extract text content.
                    // A more robust XML parser might be better for complex cases.
                    let transcriptContent = "";
                    try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                        const textNodes = xmlDoc.getElementsByTagName('text');
                        for (let i = 0; i < textNodes.length; i++) {
                            transcriptContent += textNodes[i].textContent + " ";
                        }
                    } catch (e) {
                        console.error("Error parsing transcript XML:", e);
                        transcriptContent = "Error parsing transcript XML.";
                    }
                    return transcriptContent.trim();
                })
                .catch(error => {
                    console.error("Background: Error fetching transcript:", error);
                    return "Transcript fetch failed."; // Provide fallback
                });
        } else {
            transcriptPromise = Promise.resolve(transcriptUrl); // Use the placeholder if not a URL
        }

        transcriptPromise.then(finalTranscript => {
            const analysisPayload = {
                title: title,
                link: videoUrl, // Use videoUrl from content script
                description: description,
                transcript: finalTranscript
            };

            console.log("Background: Sending to backend /get_ingredients:", analysisPayload);

            // Step 2: Call backend's /get_ingredients
            chrome.storage.local.get(['kroger_access_token'], function(result) { // Get token if needed by backend, though current backend /get_ingredients does not require it
                // const accessToken = result.kroger_access_token; // Not used for this specific backend endpoint currently

                fetch(`${BACKEND_URL}/get_ingredients`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(analysisPayload)
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw new Error(err.detail || `HTTP error! Status: ${response.status}`); });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Background: Ingredients from backend:", data);
                    if (data.ingredients) {
                        sendResponse({ success: true, ingredients: data.ingredients });
                    } else {
                        throw new Error("Ingredients not found in backend response.");
                    }
                })
                .catch(error => {
                    console.error("Background: Error getting ingredients from backend:", error);
                    sendResponse({ success: false, error: error.message });
                });
            });
        });
        return true; // Required for async sendResponse
    }
    else if (message.type === "ADD_INGREDIENTS_TO_KROGER_CART") {
        console.log("Background: ADD_INGREDIENTS_TO_KROGER_CART received", message.ingredients);
        const ingredientsToAdd = message.ingredients;

        if (!ingredientsToAdd || ingredientsToAdd.length === 0) {
            sendResponse({ success: false, error: "No ingredients provided." });
            return false; // No async work needed
        }

        chrome.storage.local.get(['kroger_access_token', 'kroger_location_id'], async function(storageData) {
            if (!storageData.kroger_access_token || !storageData.kroger_location_id) {
                sendResponse({ success: false, error: "User not authenticated or location not set." });
                return;
            }

            const accessToken = storageData.kroger_access_token;
            // Note: kroger_location_id is available in storageData,
            // but /process_ingredient backend endpoint uses token_to_location_id_map with the Bearer token.

            let addedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            let lastSkippedReason = "";

            // Process each ingredient sequentially
            for (const ingredient of ingredientsToAdd) {
                const ingredientName = typeof ingredient === 'string' ? ingredient : ingredient.name;
                try {
                    const response = await fetch(`${BACKEND_URL}/process_ingredient`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ ingredient: ingredientName })
                    });

                    if (!response.ok) {
                        let errorDetail = "Failed to process ingredient.";
                        try {
                            const errJson = await response.json();
                            errorDetail = errJson.detail || errorDetail;
                        } catch (e) { /* Ignore */ }
                        console.warn(`Processing '${ingredientName}': Status ${response.status}, Detail: ${errorDetail}`);
                        if (response.status === 404 || (typeof errorDetail === 'string' && errorDetail.includes("not found")) ) {
                            skippedCount++;
                            lastSkippedReason = "product not found";
                        } else {
                            errorCount++;
                        }
                        continue;
                    }

                    const result = await response.json();
                    console.log(`Background: Processed '${ingredientName}', result:`, result);
                    if (result.status === "added") {
                        addedCount++;
                    } else if (result.status === "skipped") {
                        skippedCount++;
                        lastSkippedReason = result.reason || "skipped by backend";
                    } else {
                        console.warn("Unexpected status from /process_ingredient:", result);
                        errorCount++;
                    }

                } catch (error) {
                    console.error(`Background: Error processing ingredient '${ingredientName}':`, error);
                    errorCount++;
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
