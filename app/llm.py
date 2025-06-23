import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException # Keep these if your llm.py still has its own app
from pydantic import BaseModel # Keep if VideoRequest is still defined here for the local app
from dotenv import load_dotenv
from pytubefix import YouTube # This seems unused in get_ingredients_from_ai now
import requests
import xml.etree.ElementTree as ET
from typing import Optional

# ... (your existing key loading and model initialization) ...
load_dotenv()

# Securely load API key
key = os.getenv('GENAI_API_KEY')
genai.configure(api_key=key)
model = genai.GenerativeModel('gemini-1.5-flash-latest') # Or your chosen model

def get_ingredients_from_ai(title: str, link: str, description: str, transcript_url: Optional[str]) -> list:
    actual_transcript_text = "Transcript not available or not provided." # Default

    if transcript_url:
        print(f"LLM: Received transcript_url: {transcript_url}")
        try:
            response = requests.get(transcript_url, timeout=15) # Increased timeout
            print(f"LLM: Transcript fetch HTTP status: {response.status_code}") # Log status
            response.raise_for_status()

            xml_content = response.text
            # CRUCIAL LOG: Print the beginning of the fetched content
            print(f"LLM: Fetched transcript content (first 500 chars): {xml_content[:500]}")

            if not xml_content.strip():
                print("LLM: Fetched transcript content is empty.")
                actual_transcript_text = "Transcript content was empty."
            else:
                try:
                    root = ET.fromstring(xml_content)
                    transcript_parts = []
                    for text_element in root.findall('.//text'):
                        if text_element.text:
                            transcript_parts.append(text_element.text.strip())

                    if transcript_parts:
                        actual_transcript_text = " ".join(transcript_parts)
                        print(f"LLM: Successfully fetched and parsed transcript. Length: {len(actual_transcript_text)}")
                    else:
                        print("LLM: XML parsed, but no <text> elements found or they were empty.")
                        actual_transcript_text = "Transcript XML parsed, but no usable content found."
                except ET.ParseError as e:
                    print(f"LLM: Error parsing transcript XML: {e}")
                    print(f"LLM: XML content that failed to parse (first 500 chars): {xml_content[:500]}")
                    actual_transcript_text = f"Error parsing transcript XML: {e}"

        except requests.exceptions.RequestException as e:
            print(f"LLM: Error fetching transcript from URL: {e}")
            actual_transcript_text = f"Error fetching transcript: {e}"
    else:
        print("LLM: No transcript_url provided.")

    prompt = (
        "You are an expert culinary assistant. Your task is to analyze the following YouTube video and extract every single ingredient mentioned in the video description or spoken in the video itself."
        " Present the ingredients as a plain, unnumbered list, with each ingredient on a new line. Do not include quantities, instructions, or any other additional text, notes, or explanations. Only list the ingredients themselves."
        f"Here is the link:\n{link} for the video."
        f"Here is the youtube video description:\n{description}."
        f"Here is the transcript of the video:\n{actual_transcript_text}."
    )
    try:
        llm_response = model.generate_content(prompt)
        ingredients = llm_response.text.split("\n")
        ingredients = [ing.strip() for ing in ingredients if ing.strip()]
        print(f"LLM: Ingredients extracted by AI: {ingredients}")
        return ingredients
    except Exception as e:
        print(f"LLM: Error generating ingredients from AI: {str(e)}")
        return [f"Error generating ingredients: {str(e)}"]