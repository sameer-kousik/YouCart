import google.generativeai as genai

genai.configure(api_key="")
def ask_gemini(prompt: str) -> str:
    model = genai.GenerativeModel("gemini-pro")
    response = model.generate_content(prompt)
    return response.text if response.text else "Sorry, I couldn't find an answer."
