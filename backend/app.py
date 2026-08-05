"""
app.py
------
AI-Powered Research Paper Summarizer - backend entry point.

Pipeline (matches the project synopsis):
  1. Upload & Extract  -> services/pdf_extractor.py
  2. NLP Preprocess    -> services/nlp_processor.py
  3. AI Summarize      -> services/summarizer.py

Run locally:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...
    python app.py
"""

import os
import traceback

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from services.pdf_extractor import extract_text_from_pdf, basic_validation
from services.nlp_processor import build_summarizer_input
from services.summarizer import summarize_paper

load_dotenv()

app = Flask(__name__)
CORS(app)  # allow the frontend (served separately) to call this API

ALLOWED_EXTENSIONS = {"pdf"}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/summarize", methods=["POST"])
def summarize():
    """
    Accepts a multipart/form-data POST with a "file" field containing
    a PDF. Runs the full extract -> preprocess -> summarize pipeline
    and returns the structured summary as JSON.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request. Use form field 'file'."}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF files are supported."}), 400

    try:
        # Stage 1: Upload & Extract
        extracted = extract_text_from_pdf(file)
        basic_validation(extracted)

        # Stage 2: NLP Preprocess
        preprocessed_text = build_summarizer_input(extracted["full_text"])

        # Stage 3: AI Summarize
        summary = summarize_paper(preprocessed_text)

        return jsonify({
            "filename": file.filename,
            "num_pages": extracted["num_pages"],
            "summary": summary,
        })

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 422
    except RuntimeError as re_err:
        return jsonify({"error": str(re_err)}), 500
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Unexpected server error while summarizing the paper."}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
