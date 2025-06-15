import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from pytubefix import YouTube

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

def get_ingredients_from_ai(title: str, link: str, description: str, transcript: str) -> list:
    # description_from_yt = get_youtube_description(link) # No longer fetching description here, it's passed in.

    print(f"Analyzing with title: {title}, link: {link}")
    print(f"Using description (first 200 chars): {description[:200] if description else 'N/A'}...")
    print(f"Using transcript (first 200 chars): {transcript[:200] if transcript else 'N/A'}...")

    # Placeholder for actual LLM call and ingredient extraction logic.
    # The prompt would need to be updated to effectively use description and transcript.
    # Example of how the prompt *could* be updated:
    # prompt = (
    #     "You are an expert culinary assistant. Your task is to analyze the following YouTube video details "
    #     "and extract every single ingredient mentioned. Prioritize spoken ingredients from the transcript, "
    #     "then consider the video description, and finally the title."
    #     " Present the ingredients as a plain, unnumbered list, with each ingredient on a new line. "
    #     "Do not include quantities, instructions, or any other additional text, notes, or explanations. "
    #     "Only list the ingredients themselves.\n\n"
    #     f"Video Title: {title}\n"
    #     f"Video Link: {link}\n"
    #     f"Video Description:\n{description}\n\n"
    #     f"Video Transcript:\n{transcript}"
    # )
    # try:
    #     # Generate content using the AI model
    #     # response = model.generate_content(prompt)
    #     # ingredients = response.text.split("\n")
    #     # return ingredients
    # except Exception as e:
    #     raise RuntimeError(f"Error generating ingredients: {str(e)}")

    # For the purpose of this subtask, returning mock ingredients as per example.
    mock_ingredients = [
        f"Ingredient from title: {title}",
        f"Ingredient from link: {link}",
        f"Ingredient based on description (first 20 chars): {description[:20] if description else 'N/A'}",
        f"Ingredient based on transcript (first 20 chars): {transcript[:20] if transcript else 'N/A'}"
    ]
    return mock_ingredients

@app.post("/get_ingredients") # This is part of llm.py's own FastAPI app, separate from main.py
async def get_ingredients(request: VideoRequest): # This endpoint in llm.py is not the one being modified by the subtask for main.py
    try:
        # Call the function to get ingredients
        ingredients = get_ingredients_from_ai(request.title, request.link)
        return {"ingredients": ingredients}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")