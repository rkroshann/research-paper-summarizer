"""
summarizer.py
-------------
Stage 3 of the pipeline: "AI Summarize"

Sends the preprocessed paper text to a generative AI model (Claude,
via the Anthropic API) and asks it to return a structured summary:
objectives, methodology, key findings/results, and conclusions -
matching the "What the System Does" section of the project synopsis.
"""

import os
import json
import re
import requests

MODEL = "gemini-flash-latest"

SYSTEM_PROMPT = """You are a research paper summarization assistant.
Given the extracted text of a scientific paper, produce a deeply comprehensive,
professional summary. You must return ONLY a JSON object and absolutely nothing else.
Do not wrap it in markdown blockquotes, do not include intro/outro text.

The JSON MUST have these exact keys:
{
  "title": "Full title of the paper",
  "one_line_summary": "An executive summary (1-2 sentences)",
  "objectives": "The problem being solved (3-4 sentences)",
  "methodology": "How they solved it (4-5 sentences)",
  "key_findings": "The main results (4-5 sentences)",
  "conclusions": "Conclusions and limitations (3-4 sentences)",
  "flowchart": "A mermaid.js diagram script mapping the paper's specific proposed methodology."
}

Ensure the mermaid flowchart is valid syntax and captures the exact algorithm or system design proposed in this specific paper.
"""


def extract_fallback_summary(preprocessed_text: str) -> dict:
    """
    Very basic string matching fallback if API completely fails.
    """
    sections = {"abstract": "", "introduction": "", "method": "", "result": "", "conclusion": "", "preamble": ""}
    current_sec = "preamble"
    for line in preprocessed_text.split("\n"):
        low_line = line.lower()
        if "abstract" in low_line and len(line) < 20: current_sec = "abstract"
        elif "introduction" in low_line and len(line) < 20: current_sec = "introduction"
        elif "method" in low_line and len(line) < 30: current_sec = "method"
        elif "result" in low_line and len(line) < 20: current_sec = "result"
        elif "conclusion" in low_line and len(line) < 20: current_sec = "conclusion"
        
        sections[current_sec] += line + "\n"

    title = "Unknown Title"
    preamble_lines = [l for l in sections.get("preamble", "").split("\n") if l.strip()]
    if preamble_lines:
        title = preamble_lines[0]

    def get_section_text(*keywords):
        for kw in keywords:
            for sec_name, text in sections.items():
                if kw in sec_name and text:
                    clean = re.sub(r"\s+", " ", text)
                    if len(clean) > 400:
                        clean = clean[:400] + "..."
                    return clean
        return "Not clearly stated in the provided text."

    abstract_text = get_section_text("abstract", "preamble", "introduction")
    objectives = get_section_text("introduction", "objective", "abstract")
    methodology = get_section_text("method", "approach", "system", "experimental setup")
    findings = get_section_text("result", "discussion", "evaluation", "experiment")
    conclusions = get_section_text("conclusion", "future work", "discussion")

    one_line = abstract_text.split(". ")[0] if abstract_text else "Research paper analysis completed."
    if len(one_line) > 200:
        one_line = one_line[:200] + "..."

    return {
        "title": title or "Research Paper",
        "one_line_summary": one_line,
        "objectives": objectives,
        "methodology": methodology,
        "key_findings": findings,
        "conclusions": conclusions,
        "flowchart": "graph TD;\n  A[PDF Uploaded] --> B[Text Extraction];\n  B --> C[NLP Processing];\n  C --> D[Fallback Summarizer];\n  D --> E[Results Displayed];",
    }


def get_api_key():
    return os.environ.get("GEMINI_API_KEY")

def summarize_paper(preprocessed_text: str) -> dict:
    """
    Call Google Gemini REST API to generate a structured summary.
    Falls back gracefully to NLP extraction if it fails.
    """
    api_key = get_api_key()
    if not api_key:
        return extract_fallback_summary(preprocessed_text)

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{
                "parts": [{"text": f"{SYSTEM_PROMPT}\n\nHere is the extracted paper text:\n\n{preprocessed_text}"}]
            }]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json\n"):
                cleaned = cleaned[5:]
            elif cleaned.startswith("json"):
                cleaned = cleaned[4:]

        return json.loads(cleaned.strip())
    except Exception as err:
        print(f"[Summarizer] API call failed ({err}). Using fallback NLP extraction.")
        return extract_fallback_summary(preprocessed_text)

