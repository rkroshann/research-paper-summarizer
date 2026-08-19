"""
presentation_generator.py
-------------------------
Generates structured JSON presentation slides from a research paper.
"""

import requests
import json
from typing import List, Dict, Any
from services.summarizer import get_api_key

def generate_presentation(summary: Dict[str, Any], text: str, visuals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generates a 5-7 slide presentation deck as a JSON object.
    Intelligently maps provided visuals to relevant slides based on context.
    """
    api_key = get_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing.")

    # Format the visuals metadata so the LLM can use them
    visuals_context = "AVAILABLE VISUALS (You can use these in your slides by referencing their id):\n"
    for v in visuals:
        visuals_context += f"ID: {v['id']} | Caption: {v['caption']} | Context: {v['context']}\n"

    prompt = f"""You are an expert academic presenter. 
Your task is to generate a highly professional 5-7 slide presentation deck based on the provided research paper summary and text.
You MUST output EXACTLY valid JSON in the structure defined below, and NOTHING else. No markdown formatting blocks around the JSON.

REQUIRED JSON STRUCTURE:
[
  {{
    "title": "Slide Title",
    "bullets": ["Point 1", "Point 2", "Point 3"],
    "visual_id": "optional_id_from_available_visuals_if_highly_relevant"
  }},
  ...
]

SLIDE GUIDELINES:
- Slide 1: Title, Authors (if available), One-line summary
- Slide 2: Problem & Motivation (Why does this matter?)
- Slide 3: Proposed Approach / Methodology (How does it work?)
- Slide 4: Methodology (Key techniques/equations)
- Slide 5: Results (Important findings, metrics)
- Slide 6: Key Insights (Major contributions)
- Slide 7: Conclusion (Takeaway, limitations, future work)

Do not use text-heavy paragraphs. Use short, punchy bullet points.
If an AVAILABLE VISUAL is highly relevant to a slide (especially Methodology or Results), include its ID in the "visual_id" field. Otherwise, leave it null.
Use the paper text for deep details.

PAPER SUMMARY:
{json.dumps(summary, indent=2)}

{visuals_context}
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
        slides = json.loads(output_text)
        return slides
    except json.JSONDecodeError as e:
        print(f"[Presentation Generator] Failed to parse JSON: {e}\nOutput was: {output_text}")
        raise ValueError("The AI failed to generate a valid presentation structure.")
