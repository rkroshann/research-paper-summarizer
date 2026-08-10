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
import concurrent.futures
from g4f.client import Client

MODEL = "gpt-4o"  # g4f will automatically route to a provider supporting this

SYSTEM_PROMPT = """You are a research paper summarization assistant.
Given the extracted text of a scientific paper, produce a deeply comprehensive,
standalone explanation of the paper. Your summary should be detailed enough that
a reader can fully understand the research without reading the original paper.
Do not invent information. If a section is missing, state it clearly.

You must also generate a Mermaid.js flowchart (graph TD) that visually maps
the core concepts, methodology, or architecture described in the paper.

Respond ONLY with valid JSON in exactly this shape, no extra prose,
no markdown fences:

{
  "title": "string or null if not identifiable",
  "one_line_summary": "single sentence TL;DR",
  "objectives": "Deep, comprehensive explanation of the problem and goals",
  "methodology": "Deep, comprehensive explanation of the approach/method/model",
  "key_findings": "Deep, comprehensive explanation of the main results",
  "conclusions": "Deep, comprehensive explanation of conclusions and limitations",
  "flowchart": "graph TD;\\n A[Start] --> B[Step 1];\\n B --> C[End];"
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
        "flowchart": "graph TD;\n  A[PDF Uploaded] --> B[Text Extraction];\n  B --> C[NLP Processing];\n  C --> D[Fallback Summarizer];\n  D --> E[Results Displayed];",
    }


def get_client():
    return Client()


def summarize_paper(preprocessed_text: str) -> dict:
    """
    Call g4f (GPT4Free) API to generate a structured summary without an API key.
    Falls back gracefully to NLP extraction if it fails.
    """
    client = get_client()

    try:
        def fetch_summary():
            return client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Here is the extracted paper text:\n\n{preprocessed_text}"},
                ],
            )
            
        # Run g4f with a 60 second timeout to allow large PDFs to process
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = executor.submit(fetch_summary)
        try:
            response = future.result(timeout=60)
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        raw_text = response.choices[0].message.content

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

