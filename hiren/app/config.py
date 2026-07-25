import os
from dotenv import load_dotenv

load_dotenv()

# Gemini API configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-live-preview")
LIVE_API_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"

DEFAULT_USER = {
    "name": "Rushabh P.",
    "phone": "+1 (201) 555-0142",
    "campus": "NYU Tandon"
}

DEFAULT_LOCATION = {
    "lat": 40.6942,
    "lng": -73.9865,
    "label": "5 MetroTech Center, Brooklyn, NY 11201"
}
