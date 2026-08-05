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
import anthropic

MODEL = "claude-3-5-sonnet-20241022"

SYSTEM_PROMPT = """You are a research paper summarization assistant.
Given the extracted text of a scientific paper, produce a structured,
faithful, extreme summary. Do not invent information that is not
present in the text. If a section (e.g. results) is not present,
say "Not clearly stated in the provided text" for that field.

Respond ONLY with valid JSON in exactly this shape, no extra prose,
no markdown fences:

{
  "title": "string or null if not identifiable",
  "one_line_summary": "single sentence TL;DR",
  "objectives": "what problem the paper addresses and its goals",
  "methodology": "the approach / method / model used",
  "key_findings": "the main results, in plain language",
  "conclusions": "what the authors conclude, limitations, future work if mentioned"
}
"""


def extract_fallback_summary(preprocessed_text: str) -> dict:
    """Extract a heuristic structured summary from preprocessed paper text when API key is absent or API fails."""
    sections = {}
    current_sec = "preamble"
    sections[current_sec] = []

    for line in preprocessed_text.split("\n"):
        if line.startswith("## "):
            current_sec = line[3:].strip().lower()
            sections[current_sec] = []
        else:
            sections[current_sec].append(line)

    for k in sections:
        sections[k] = "\n".join(sections[k]).strip()

    title = None
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
    }


def get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return anthropic.Anthropic(api_key=api_key)


def summarize_paper(preprocessed_text: str) -> dict:
    """
    Call the Anthropic API to generate a structured summary.
    Falls back gracefully to NLP extraction if API key is not configured or API fails.
    """
    client = get_client()
    if not client:
        return extract_fallback_summary(preprocessed_text)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1200,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Here is the extracted paper text:\n\n{preprocessed_text}",
                }
            ],
        )

        raw_text = "".join(
            block.text for block in response.content if block.type == "text"
        )

        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json\n"):
                cleaned = cleaned[5:]

        return json.loads(cleaned)
    except Exception as err:
        print(f"[Summarizer] API call failed ({err}). Using fallback NLP extraction.")
        return extract_fallback_summary(preprocessed_text)
