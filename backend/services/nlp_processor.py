"""
nlp_processor.py
-----------------
Stage 2 of the pipeline: "NLP Preprocess"

Cleans raw extracted PDF text and identifies likely section
boundaries (Abstract, Introduction, Methodology, Results,
Conclusion, References, ...) using heuristics. This keeps the
generative model's input focused and removes noise (headers,
footers, page numbers, reference lists) before summarization.
"""

import re

# Common section header names found in research papers.
SECTION_HEADERS = [
    "abstract",
    "introduction",
    "related work",
    "background",
    "methodology",
    "methods",
    "materials and methods",
    "proposed method",
    "proposed system",
    "experiments",
    "experimental setup",
    "results",
    "results and discussion",
    "discussion",
    "evaluation",
    "conclusion",
    "conclusions",
    "future work",
    "references",
    "acknowledgements",
    "acknowledgments",
]

HEADER_PATTERN = re.compile(
    r"^\s*(?:\d+[.\)]?\s*)?(" + "|".join(SECTION_HEADERS) + r")\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# Lines that are almost always noise in extracted PDF text.
NOISE_PATTERNS = [
    r"^\s*\d+\s*$",                      # bare page numbers
    r"^\s*Page\s+\d+\s+of\s+\d+\s*$",    # "Page 3 of 10"
    r"^\s*©.*$",                         # copyright lines
    r"^\s*doi:.*$",                      # DOI lines
    r"^\s*ISSN[:\s].*$",
]
NOISE_RE = [re.compile(p, re.IGNORECASE) for p in NOISE_PATTERNS]


def clean_text(raw_text: str) -> str:
    """Remove boilerplate noise and normalize whitespace."""
    lines = raw_text.split("\n")
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if any(pattern.match(stripped) for pattern in NOISE_RE):
            continue
        cleaned_lines.append(stripped)

    text = "\n".join(cleaned_lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def split_into_sections(cleaned_text: str) -> dict:
    """
    Split cleaned text into a dict of {section_name: section_text}
    using detected headers. Anything before the first recognized
    header is bucketed under "preamble" (usually title/authors/abstract).
    """
    matches = list(HEADER_PATTERN.finditer(cleaned_text))

    if not matches:
        return {"full_text": cleaned_text}

    sections = {}
    preamble = cleaned_text[: matches[0].start()].strip()
    if preamble:
        sections["preamble"] = preamble

    for i, match in enumerate(matches):
        name = match.group(1).strip().lower()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned_text)
        body = cleaned_text[start:end].strip()
        if body:
            # Merge duplicate-named sections instead of overwriting
            if name in sections:
                sections[name] += "\n" + body
            else:
                sections[name] = body

    return sections


def drop_references(sections: dict) -> dict:
    """Remove reference/acknowledgement sections - not useful for summarization."""
    drop_keys = {"references", "acknowledgements", "acknowledgments"}
    return {k: v for k, v in sections.items() if k not in drop_keys}


def build_summarizer_input(raw_text: str, max_chars: int = 20000) -> str:
    """
    Full preprocessing pipeline: clean -> section-split -> drop noise
    sections -> reassemble into a single string ready for the
    generative model, truncated to a safe context length.
    """
    cleaned = clean_text(raw_text)
    sections = split_into_sections(cleaned)
    sections = drop_references(sections)

    parts = []
    for name, body in sections.items():
        parts.append(f"## {name.title()}\n{body}")

    combined = "\n\n".join(parts)

    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n\n[...truncated...]"

    return combined
