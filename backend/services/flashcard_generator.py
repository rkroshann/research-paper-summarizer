"""
flashcard_generator.py
----------------------
Generates study flashcards based on the research paper's chunks and summary.
"""

import requests
import json
from typing import List, Dict, Any
from services.summarizer import get_api_key

def generate_flashcards(summary: Dict[str, Any], chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generates an array of study flashcards as JSON.
    """
    api_key = get_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing.")

    # Combine chunk texts to give context (limit to avoid token overflow)
    context_text = "\n\n".join([f"{c['text']}" for c in chunks[:15]])

    prompt = f"""You are an expert academic tutor. 
Your task is to generate 15-20 highly effective study flashcards based on the provided research paper excerpts and summary.
You MUST output EXACTLY valid JSON in the structure defined below, and NOTHING else. No markdown wrappers.

REQUIRED JSON STRUCTURE:
[
  {{
    "type": "Definition",
    "front": "What is the main research problem addressed by this paper?",
    "back": "The paper addresses...",
    "source": "Source: Page X / Section Y"
  }},
  ...
]

FLASHCARD TYPES TO INCLUDE:
- Definition (Explain a key term)
- Concept (Core ideas)
- Methodology (How a specific part works)
- Result (Important numbers or findings)
- Insight (Major contribution or limitation)
- Equation (Use LaTeX math formatting like $$E=mc^2$$ or $x_i$ if relevant equations exist)

RULES:
- Ensure the questions are clear and concise.
- Provide accurate answers grounded ONLY in the text.
- Always provide a realistic source citation (e.g. "Source: Page 3").

PAPER SUMMARY:
{json.dumps(summary, indent=2)}

PAPER CONTEXT (First few pages):
{context_text}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload)
    res.raise_for_status()
    res_data = res.json()
    
    output_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
    
    # Clean up markdown if present
    output_text = output_text.replace("```json", "").replace("```", "").strip()
    
    try:
        cards = json.loads(output_text)
        return cards
    except json.JSONDecodeError as e:
        print(f"[Flashcard Generator] Failed to parse JSON: {e}\nOutput was: {output_text}")
        raise ValueError("The AI failed to generate valid flashcards.")
