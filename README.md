# AI-Powered Research Paper Summarizer — Project Base

This is a working starter implementation of the system described in the
project synopsis: upload a research paper (PDF), extract its text,
preprocess it with NLP, and generate a structured summary (objectives,
methodology, key findings, conclusions) using a generative AI model.

## How it maps to the synopsis

| Synopsis stage      | Code                                  |
|----------------------|----------------------------------------|
| Upload & Extract     | `backend/services/pdf_extractor.py`   |
| NLP Preprocess        | `backend/services/nlp_processor.py`   |
| AI Summarize           | `backend/services/summarizer.py`      |
| API that ties it together | `backend/app.py`                 |
| User-facing UI        | `frontend/index.html`                 |

## Project structure

```
research-paper-summarizer/
├── backend/
│   ├── app.py                     # Flask API (POST /api/summarize)
│   ├── requirements.txt
│   └── services/
│       ├── pdf_extractor.py       # Stage 1: PDF -> raw text
│       ├── nlp_processor.py       # Stage 2: clean + section-split text
│       └── summarizer.py          # Stage 3: generative summary via Claude
└── frontend/
    └── index.html                 # Upload UI + results view
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Set your Anthropic API key (get one at https://console.anthropic.com):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or create a `backend/.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Run the server:

```bash
python app.py
```

The API is now live at `http://localhost:5000`.

### 2. Frontend

The frontend is a single static HTML file with no build step. Just open
`frontend/index.html` in a browser, or serve it:

```bash
cd frontend
python -m http.server 8000
```

Then visit `http://localhost:8000`. It's already wired to call the
backend at `http://localhost:5000` (see `API_BASE` in `index.html`).

## API

**POST** `/api/summarize`
Multipart form with a `file` field containing a PDF.

Response:
```json
{
  "filename": "paper.pdf",
  "num_pages": 8,
  "summary": {
    "title": "...",
    "one_line_summary": "...",
    "objectives": "...",
    "methodology": "...",
    "key_findings": "...",
    "conclusions": "..."
  }
}
```

**GET** `/api/health` — simple liveness check.

## What's already handled

- PDF text extraction with `pdfplumber`
- Noise removal (page numbers, DOIs, copyright lines) and heuristic
  section-splitting (Abstract / Methodology / Results / Conclusion / etc.)
- Reference/acknowledgement sections are dropped before summarization
  to keep the model focused on real content
- Structured JSON output from the model, with a safe fallback if the
  model output isn't valid JSON
- Basic validation: rejects non-PDFs, rejects PDFs with no extractable
  text (e.g. scanned images with no OCR layer)
- CORS enabled so the static frontend can call the API directly

## Natural next steps (not yet built)

These map to ideas in your literature review (SciTLDR, BART/T5, etc.)
and are good follow-ups once the base is running end-to-end:

- OCR fallback (e.g. `pytesseract`) for scanned/image-only PDFs
- Support for `.docx` / arXiv URL input, not just PDF upload
- Caching summaries by file hash so re-uploads don't re-call the API
- A "compare against SciTLDR-style extreme summary" mode (very short
  single-sentence TL;DR vs. the fuller structured summary)
- User accounts + history of past summarized papers
- Swap the heuristic NLP section-splitter for a fine-tuned classifier
  if paper formatting varies a lot in your target domain
