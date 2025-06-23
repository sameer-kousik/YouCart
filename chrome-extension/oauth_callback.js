console.log("OAuth callback script loaded.");
// Logic to extract code and send to background script will go here.
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
    console.log("OAuth code found:", code);
    // Construct the exact redirect URI that was used to get this code.
    const currentRedirectUri = window.location.origin + window.location.pathname;
    chrome.runtime.sendMessage(
        { type: "KROGER_CODE_RECEIVED", code: code, redirectUri: currentRedirectUri }, // Pass the correct redirectUri
        response => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message to background:", chrome.runtime.lastError.message);
            document.body.innerHTML = "<p>Error sending code to background script. Check console.</p>";
        } else {
            console.log("Code sent to background script. Closing tab...");
            // Optionally, show a success message before closing or let background script close it.
            document.body.innerHTML = "<p>Login successful! You can close this tab.</p>";
            // window.close(); // Might not work depending on how tab was opened
        }
    });
} else {
    console.error("No OAuth code found in URL.");
    document.body.innerHTML = "<p>OAuth authentication failed. No code found.</p>";
}
