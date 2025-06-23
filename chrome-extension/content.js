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
    console.log("YouCart content.js: Attempting to get full video description.");
    let fullDescription = "";

    // Try a selector known to often hold the main description text container
    // YouTube's classes can be complex and dynamic. This selector targets a common pattern.
    const descriptionRenderer = document.querySelector('ytd-expandable-video-description-body-renderer');

    if (descriptionRenderer) {
        // The actual text is often within a child element with the class 'yt-core-attributed-string'
        // or spread across multiple such elements if formatted.
        const textElements = descriptionRenderer.querySelectorAll('.yt-core-attributed-string');
        if (textElements && textElements.length > 0) {
            textElements.forEach(el => {
                fullDescription += el.innerText + '\n'; // Concatenate text from all found elements
            });
            fullDescription = fullDescription.trim();
        } else if (descriptionRenderer.innerText) {
            // Fallback if specific children not found, take all innerText of the renderer
            fullDescription = descriptionRenderer.innerText.trim();
        }
    }

    if (fullDescription) {
        console.log("YouCart content.js: Full description found, length:", fullDescription.length);
        return fullDescription;
    }

    // Fallback to the previous, potentially partial, selector if the new one fails
    console.warn("YouCart content.js: New full description selector failed. Falling back to old method.");
    const oldDescriptionElement = document.querySelector('#description .ytd-watch-metadata #description-inline-expander span, #description.ytd-watch-metadata .ytd-expandable-video-description-body-renderer'); // Old selector
    if (oldDescriptionElement) {
        fullDescription = oldDescriptionElement.innerText.trim();
        console.log("YouCart content.js: Fallback description found, length:", fullDescription.length);
        return fullDescription;
    }

    console.warn("YouCart content.js: Could not extract video description.");
    return "Description not found or could not be extracted.";
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
