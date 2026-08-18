"""
tts_service.py
--------------
Generates a podcast script using Gemini and converts it to audio using gTTS (or other TTS providers).
"""

import os
from gtts import gTTS
import requests
import uuid
from services.summarizer import get_api_key

def generate_podcast_script(summary_data: dict) -> str:
    api_key = get_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing.")

    prompt = f"""You are a professional podcast host explaining a recent research paper to an enthusiastic audience.
Write a highly engaging, conversational 2-3 minute script summarizing the following paper. 
Do not use stage directions (like [Host laughs] or [Music plays]). Just write the spoken text.
Keep it natural, easy to understand, and focus on the problem, the clever methodology, and the main findings.

Paper Details:
Title: {summary_data.get('title', 'Unknown')}
Objectives: {summary_data.get('objectives', '')}
Methodology: {summary_data.get('methodology', '')}
Findings: {summary_data.get('key_findings', '')}
Conclusions: {summary_data.get('conclusions', '')}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload)
    res.raise_for_status()
    res_data = res.json()
    script = res_data["candidates"][0]["content"]["parts"][0]["text"]
    return script

def generate_audio_from_text(text: str, output_path: str):
    # Using gTTS as a simple fallback
    tts = gTTS(text=text, lang='en', slow=False)
    tts.save(output_path)
