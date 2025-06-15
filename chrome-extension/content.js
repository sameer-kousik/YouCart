// In content.js
console.log("YouCart content script loaded and active on a YouTube watch page.");

function getVideoTitle() {
    // Try YouTube's specific metadata element first
    const metaTitle = document.querySelector('meta[name="title"]');
    if (metaTitle && metaTitle.content) {
        return metaTitle.content;
    }
    // Fallback to document.title (might include " - YouTube")
    return document.title;
}

function getVideoDescription() {
    // YouTube description is often in a container with ID "description" or "description-inner"
    // This might need adjustment if YouTube changes its layout.
    const descriptionElement = document.querySelector('#description .ytd-watch-metadata #description-inline-expander span, #description.ytd-watch-metadata .ytd-expandable-video-description-body-renderer');
    if (!descriptionElement) {
        console.warn("YouCart content.js: Description element not found. YouTube structure might have changed.");
        return "Description not found.";
    }
    return descriptionElement.innerText.trim();
}

function getVideoTranscript() {
    try {
        // Find the script tag containing ytInitialPlayerResponse
        const scripts = Array.from(document.getElementsByTagName('script'));
        const playerResponseScript = scripts.find(script => script.textContent.includes('ytInitialPlayerResponse = {'));

        if (playerResponseScript) {
            // Extract the JSON string
            const scriptContent = playerResponseScript.textContent;
            const jsonString = scriptContent.substring(scriptContent.indexOf('{'), scriptContent.lastIndexOf('}') + 1);
            const playerResponse = JSON.parse(jsonString);

            if (playerResponse.captions && playerResponse.captions.playerCaptionsTracklistRenderer) {
                const tracklist = playerResponse.captions.playerCaptionsTracklistRenderer;
                if (tracklist.captionTracks && tracklist.captionTracks.length > 0) {
                    // Prefer "a.en" (auto-generated English) or simple English if available
                    let chosenTrack = tracklist.captionTracks.find(track => track.vssId === "a.en");
                    if (!chosenTrack) {
                        chosenTrack = tracklist.captionTracks.find(track => track.languageCode === "en");
                    }
                    if (!chosenTrack && tracklist.captionTracks.length > 0) {
                         // Fallback to the first available track if no English found
                        chosenTrack = tracklist.captionTracks[0];
                    }

                    if (chosenTrack && chosenTrack.baseUrl) {
                        // The baseUrl gives an XML transcript.
                        // For simplicity in this step, we'll return the URL to fetch it.
                        // Background script can then fetch and parse it.
                        // Or, content script could fetch it here if CORS allows or via background message.
                        // For now, let's assume background will fetch.
                        console.log("Transcript URL found:", chosenTrack.baseUrl);
                        return chosenTrack.baseUrl; // This URL will be for an XML file (Timed Text format)
                    }
                }
                 if (tracklist.translationLanguages && tracklist.translationLanguages.length > 0) {
                    // If no direct caption tracks, check if translations are available (might indicate original is different lang)
                    // This part is more complex as it involves selecting a translation.
                    console.warn("No direct English caption tracks found, but translation languages are available.");
                }
            }
        }
        return "Transcript not available or ytInitialPlayerResponse format changed.";
    } catch (e) {
        console.error("Error extracting transcript:", e);
        return "Error extracting transcript.";
    }
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_YOUTUBE_VIDEO_DETAILS") {
        console.log("Content script: GET_YOUTUBE_VIDEO_DETAILS received.");
        const details = {
            title: getVideoTitle(),
            description: getVideoDescription(),
            transcriptUrl: getVideoTranscript(), // Send URL, background will fetch
            videoUrl: window.location.href
        };
        console.log("Content script: Sending details:", details);
        sendResponse(details);
    }
    return true; // Necessary for asynchronous sendResponse
});
