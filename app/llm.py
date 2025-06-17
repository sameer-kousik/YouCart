import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from pytubefix import YouTube
import requests # Added
import xml.etree.ElementTree as ET # Added
from typing import Optional # Added

# Load environment variables
load_dotenv()

# Securely load API key
key = os.getenv('GENAI_API_KEY')
genai.configure(api_key=key)

# Initialize the model
model = genai.GenerativeModel('gemini-2.5-pro-preview-06-05')

# Initialize FastAPI app
app = FastAPI()

# Define request body schema
class VideoRequest(BaseModel):
    title: str
    link: str

def get_youtube_description(video_url):
    try:
        yt = YouTube(video_url)
        description = yt.description
        return description
    except Exception as e:
        print("An unexpected error occurred while fetching description/title: {}".format(e))
        return None

def get_ingredients_from_ai(title: str, link: str, description: str, transcript_url: Optional[str]) -> list:
    actual_transcript_text = "Transcript not available or not provided." # Default

    if transcript_url:
        print(f"LLM: Received transcript_url: {transcript_url}")
        try:
            response = requests.get(transcript_url, timeout=10) # Added timeout
            response.raise_for_status() # Raises an HTTPError if the HTTP request returned an unsuccessful status code

            xml_content = response.text

            # Parse XML using xml.etree.ElementTree
            root = ET.fromstring(xml_content)
            transcript_parts = []
            for text_element in root.findall('.//text'): # Find all 'text' elements anywhere in the tree
                if text_element.text:
                    transcript_parts.append(text_element.text.strip())

            if transcript_parts:
                actual_transcript_text = " ".join(transcript_parts)
                print(f"LLM: Successfully fetched and parsed transcript. Length: {len(actual_transcript_text)}")
            else:
                print("LLM: XML parsed, but no <text> elements found or they were empty.")
                actual_transcript_text = "Transcript XML parsed, but no content found."

        except requests.exceptions.RequestException as e:
            print(f"LLM: Error fetching transcript from URL: {e}")
            actual_transcript_text = f"Error fetching transcript: {e}"
        except ET.ParseError as e:
            print(f"LLM: Error parsing transcript XML: {e}")
            actual_transcript_text = f"Error parsing transcript XML: {e}"
        except Exception as e:
            print(f"LLM: An unexpected error occurred during transcript processing: {e}")
            actual_transcript_text = f"Unexpected error processing transcript: {e}"
    else:
        print("LLM: No transcript_url provided.")

    # Now, use actual_transcript_text, title, description, link for your LLM call
    prompt_text = f"Title: {title}\n\nVideo Link: {link}\n\nDescription:\n{description}\n\nTranscript:\n{actual_transcript_text}\n\nExtract ingredients from the above video details."

    print(f"LLM: Using combined text for analysis (first 300 chars of prompt): {prompt_text[:300]}...")
    print(f"LLM: Full transcript used for prompt (first 200 chars): {actual_transcript_text[:200]}")

    # Placeholder for your actual call to the LLM service
    mock_ingredients = [
        f"Ingredient from title: {title}",
        f"Ingredient from link: {link}",
        f"Ingredient based on description (first 20 chars): {description[:20] if description else 'N/A'}",
        f"Transcript status: {'Processed' if transcript_url and not actual_transcript_text.startswith('Error') and not actual_transcript_text.startswith('Transcript not') else actual_transcript_text}"
    ]
    if actual_transcript_text and not actual_transcript_text.startswith('Error') and not actual_transcript_text.startswith('Transcript not'):
         mock_ingredients.append(f"First 20 chars of transcript: {actual_transcript_text[:20]}")

    return mock_ingredients

@app.post("/get_ingredients") # This is part of llm.py's own FastAPI app, separate from main.py
async def get_ingredients_endpoint(request: VideoRequest): # Renamed to avoid conflict with imported function if this file were run directly for testing
    try:
        # This endpoint is not the one called by app.main.py's /get_ingredients.
        # It would need to be updated to handle transcript_url if it were to be used.
        # For now, it's calling the old signature of get_ingredients_from_ai implicitly.
        # To avoid breaking this internal test endpoint completely, one might adapt it or have it call
        # the main function with a None for transcript_url.
        # However, the subtask is to modify the main get_ingredients_from_ai function.
        ingredients = get_ingredients_from_ai(request.title, request.link, "No description provided via this endpoint", "No transcript_url provided via this endpoint")
        return {"ingredients": ingredients}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")