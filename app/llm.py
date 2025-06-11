import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Securely load API key
key = os.getenv('GENAI_API_KEY')
genai.configure(api_key=key)

# Initialize the model
model = genai.GenerativeModel('gemini-2.0-flash')

# Initialize FastAPI app
app = FastAPI()

# Define request body schema
class VideoRequest(BaseModel):
    title: str
    link: str

def get_ingredients_from_ai(title: str, link: str) -> list:
    prompt = (
        "I want you to analyze the YouTube video I provide and extract only the list of ingredients used in the recipe. "
        "Do not include any additional text, explanations, or notes. "
        f"Here is the link:\n{link} for the video titled '{title}'. "
        "Please return the ingredients as a plain list, one ingredient per line."
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