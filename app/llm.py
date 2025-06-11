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

def get_ingredients_from_ai(title: str, link: str) -> list:
    description = get_youtube_description(link)
    prompt = (
    "You are an expert culinary assistant. Your task is to analyze the following YouTube video and extract every single ingredient mentioned in the video description or spoken in the video itself."
    " Present the ingredients as a plain, unnumbered list, with each ingredient on a new line. Do not include quantities, instructions, or any other additional text, notes, or explanations. Only list the ingredients themselves."
    f"Here is the link:\n{link} for the video."
    f"Here is the youtube video description:\n{description}."
    )
    try:
        # Generate content using the AI model
        response = model.generate_content(prompt)
        ingredients = response.text.split("\n")  # Split the response into a list of ingredients
        return ingredients
    except Exception as e:
        raise RuntimeError(f"Error generating ingredients: {str(e)}")

@app.post("/get_ingredients")
async def get_ingredients(request: VideoRequest):
    try:
        # Call the function to get ingredients
        ingredients = get_ingredients_from_ai(request.title, request.link)
        return {"ingredients": ingredients}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")