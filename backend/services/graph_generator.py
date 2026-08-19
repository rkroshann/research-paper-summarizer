"""
graph_generator.py
------------------
Generates a Mermaid.js knowledge graph based on multiple paper summaries.
"""

import requests
from services.summarizer import get_api_key

def generate_multi_paper_graph(papers_data: list) -> str:
    """
    Accepts a list of dictionaries containing paper data (title, one_line_summary, key_findings)
    and prompts the LLM to generate a Mermaid.js graph representing the relationships between them.
    """
    api_key = get_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing.")

    context = ""
    for i, p in enumerate(papers_data):
        title = p.get('title', f"Paper {i+1}")
        summary = p.get('one_line_summary', '')
        findings = p.get('key_findings', '')
        context += f"PAPER {i+1}:\nTitle: {title}\nSummary: {summary}\nKey Findings: {findings}\n\n"

    prompt = f"""You are an expert researcher. I am providing you with summaries of several research papers.
Your task is to analyze them and create a knowledge graph showing the relationships between them.
Relationships can be: Improves upon, Builds upon, Uses same dataset, Similar methodology, Supports, Contradicts, Extends, or Cites.

CRITICAL RULES:
1. Output ONLY valid JSON representing the graph, and nothing else. No markdown wrappers.
2. If there are no meaningful relationships, output an empty JSON object: {{}}

REQUIRED JSON STRUCTURE:
{{
  "nodes": [
    {{ "id": "1", "label": "Paper 1 Title", "group": "paper" }}
  ],
  "edges": [
    {{ "source": "1", "target": "2", "label": "Contradicts", "type": "contradiction" }}
  ]
}}

Types of edges (use exactly one): citation, similarity, contradiction, extension, generic.

PAPER SUMMARIES:
{context}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload)
    res.raise_for_status()
    res_data = res.json()
    graph_str = res_data["candidates"][0]["content"]["parts"][0]["text"]
    
    # Clean up if the model wrapped it in markdown anyway
    graph_str = graph_str.replace("```json", "").replace("```", "").strip()
    
    try:
        import json
        graph_data = json.loads(graph_str)
        return graph_data
    except Exception as e:
        print("[Graph Generator] Failed to parse JSON:", e)
        return {}

