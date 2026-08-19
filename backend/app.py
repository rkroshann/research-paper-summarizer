"""
app.py
------
AI-Powered Research Paper Summarizer - backend entry point.
"""

import os
import traceback
import requests
import json

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from services.pdf_extractor import extract_text_from_pdf, basic_validation
from services.nlp_processor import build_summarizer_input
from services.summarizer import summarize_paper, get_api_key
from services.storage import create_session, update_session, get_session
from services.rag_engine import chunk_text, generate_embeddings, retrieve_relevant_chunks

load_dotenv()

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {"pdf"}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


from services.visual_extractor import extract_visuals

@app.route("/api/summarize", methods=["POST"])
def summarize():
    """
    Accepts a multipart/form-data POST with a "file" field containing a PDF.
    Extracts text, caches chunks and embeddings in a session,
    and returns the structured summary as JSON along with the session_id.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request. Use form field 'file'."}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF files are supported."}), 400

    try:
        # Create session
        session_id = create_session()
        
        file_bytes = file.read()
        file.seek(0)

        # Stage 1: Upload & Extract
        extracted = extract_text_from_pdf(file)
        basic_validation(extracted)
        full_text = extracted["full_text"]

        # Visuals extraction
        static_dir = os.path.join(app.root_path, "static", "visuals")
        visuals = extract_visuals(file_bytes, static_dir)
        update_session(session_id, "visuals", visuals)

        # Stage 2: NLP Preprocess
        preprocessed_text = build_summarizer_input(full_text)
        update_session(session_id, "text", preprocessed_text)

        # Stage 3: AI Summarize
        summary = summarize_paper(preprocessed_text)
        update_session(session_id, "summary", summary)

        # Stage 4: Background Cache for RAG (Chunking & Embeddings)
        chunks = chunk_text(extracted["pages"])
        update_session(session_id, "chunks", chunks)
        
        # We can generate embeddings now so it's ready for chat
        try:
            embeddings = generate_embeddings(chunks)
            update_session(session_id, "embeddings", embeddings)
        except Exception as emb_err:
            print(f"[RAG] Failed to generate embeddings: {emb_err}")
            update_session(session_id, "embeddings", None)

        return jsonify({
            "session_id": session_id,
            "filename": file.filename,
            "num_pages": extracted["num_pages"],
            "summary": summary,
            "visuals": visuals,
        })

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 422
    except RuntimeError as re_err:
        return jsonify({"error": str(re_err)}), 500
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Unexpected server error while summarizing the paper."}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    RAG Chat Endpoint.
    Expects JSON: { "session_id": "...", "message": "..." }
    """
    data = request.json or {}
    session_id = data.get("session_id")
    message = data.get("message", "").strip()

    if not session_id or not message:
        return jsonify({"error": "Missing session_id or message"}), 400

    session_data = get_session(session_id)
    if not session_data:
        return jsonify({"error": "Invalid or expired session"}), 404

    chunks = session_data.get("chunks", [])
    embeddings = session_data.get("embeddings")

    if not chunks or embeddings is None:
        return jsonify({"error": "Paper embeddings not ready yet. Please wait."}), 400

    # Retrieve relevant chunks
    relevant_chunks = retrieve_relevant_chunks(message, chunks, embeddings)
    context = "\n\n---\n\n".join(relevant_chunks)

    api_key = get_api_key()
    if not api_key:
        return jsonify({"answer": "I cannot answer this right now because the GEMINI_API_KEY is not configured on the backend."})

    prompt = f"""You are an excellent, highly-capable research assistant explaining a scientific paper.
Your task is to answer the user's question clearly, concisely, and accurately, based ONLY on the provided text excerpts.

### BEHAVIOR RULES:
1. Grounded Answers: If the answer is not contained in the excerpts, clearly state: "I couldn't find this information in the uploaded paper."
2. Readability: Use short paragraphs, bullet points, and numbered steps where appropriate. Avoid unnecessary jargon, or explain the jargon simply if you must use it.
3. Adaptability: If the user asks for a simple explanation, break it down step-by-step. If they ask for a metric, give the number immediately.
4. Citations: When you provide facts from the paper, you MUST include a citation indicating the source page using the metadata tags found in the text excerpts. Format citations like this: `(Source: Page X)`.

TEXT EXCERPTS:
{context}

USER QUESTION: {message}
"""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload)
        res.raise_for_status()
        res_data = res.json()
        answer = res_data["candidates"][0]["content"]["parts"][0]["text"]
        
        return jsonify({"answer": answer})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate answer from LLM."}), 500


from services.tts_service import generate_podcast_script, generate_audio_from_text
import uuid

@app.route("/api/podcast", methods=["POST"])
def podcast():
    """
    Podcast endpoint.
    Expects JSON: { "session_id": "..." }
    """
    data = request.json or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    session_data = get_session(session_id)
    if not session_data:
        return jsonify({"error": "Invalid or expired session"}), 404

    if session_data.get("podcast_audio_path"):
        return jsonify({"audio_url": session_data["podcast_audio_path"]})

    summary = session_data.get("summary")
    if not summary:
        return jsonify({"error": "Summary not available yet"}), 400

    try:
        script = session_data.get("podcast_script")
        if not script:
            script = generate_podcast_script(summary)
            update_session(session_id, "podcast_script", script)
        
        audio_filename = f"{uuid.uuid4().hex}.mp3"
        audio_filepath = os.path.join(app.root_path, "static", "audio", audio_filename)
        os.makedirs(os.path.dirname(audio_filepath), exist_ok=True)
        
        generate_audio_from_text(script, audio_filepath)
        
        audio_url = f"/static/audio/{audio_filename}"
        update_session(session_id, "podcast_audio_path", audio_url)
        
        return jsonify({"audio_url": audio_url})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate podcast."}), 500


from services.graph_generator import generate_multi_paper_graph

@app.route("/api/knowledge-graph", methods=["POST"])
def knowledge_graph():
    """
    Accepts a multipart/form-data POST with multiple "files" containing PDFs.
    Summarizes each and generates a relationship graph.
    """
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided. Use form field 'files'."}), 400

    if len(files) < 2:
        return jsonify({"error": "Please upload at least 2 papers to generate a knowledge graph."}), 400

    papers_data = []
    summaries = []

    try:
        # Create a session for this graph workspace
        session_id = create_session()
        all_chunks = []
        
        for file in files:
            if not allowed_file(file.filename):
                continue
                
            # Quick extract and summarize
            extracted = extract_text_from_pdf(file)
            preprocessed_text = build_summarizer_input(extracted["full_text"])
            summary = summarize_paper(preprocessed_text)
            
            papers_data.append({
                "title": file.filename,
                "one_line_summary": summary.get("one_line_summary", ""),
                "key_findings": summary.get("key_findings", "")
            })
            
            summary["title"] = file.filename
            summaries.append(summary)
            
            # Chunking for GraphRAG
            paper_chunks = chunk_text(extracted["pages"])
            # Prefix chunks with paper title
            for c in paper_chunks:
                c["text"] = f"[Paper: {file.filename}] " + c["text"]
            all_chunks.extend(paper_chunks)

        graph_data = generate_multi_paper_graph(papers_data)
        
        # Save GraphRAG data to session
        update_session(session_id, "chunks", all_chunks)
        try:
            embeddings = generate_embeddings(all_chunks)
            update_session(session_id, "embeddings", embeddings)
        except Exception as emb_err:
            print(f"[GraphRAG] Failed to generate embeddings: {emb_err}")

        return jsonify({
            "session_id": session_id,
            "graph": graph_data,
            "summaries": summaries
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate knowledge graph."}), 500

@app.route("/api/graph-chat", methods=["POST"])
def graph_chat():
    """
    GraphRAG chat endpoint. 
    Expects JSON: { "session_id": "...", "message": "...", "paper_a": "...", "paper_b": "..." }
    """
    data = request.json or {}
    session_id = data.get("session_id")
    message = data.get("message")
    paper_a = data.get("paper_a")
    paper_b = data.get("paper_b")

    if not session_id or not message:
        return jsonify({"error": "Missing session_id or message"}), 400

    session_data = get_session(session_id)
    if not session_data or not session_data.get("chunks"):
        return jsonify({"error": "Invalid session or missing RAG data"}), 404

    chunks = session_data["chunks"]
    embeddings = session_data.get("embeddings")
    
    # Simple semantic search using existing RAG engine
    try:
        from services.rag_engine import retrieve_relevant_chunks
        from services.summarizer import get_api_key
        
        # Modify the query to heavily favor the specific papers if provided
        query_modifier = ""
        if paper_a and paper_b:
            query_modifier = f" Focus specifically on {paper_a} and {paper_b}."
        
        relevant_chunks = retrieve_relevant_chunks(message + query_modifier, chunks, embeddings, top_k=6)
        
        context_text = "\n\n".join([f"{c['text']}" for c in relevant_chunks])
        
        prompt = f"""You are an expert academic research assistant analyzing a knowledge graph connection.
Use ONLY the provided context excerpts to answer the question. Do not hallucinate.
When citing, cite the specific [Paper: Title] and [Source: Page X] from the excerpts.

CONTEXT EXCERPTS:
{context_text}

USER QUESTION:
{message}
"""
        api_key = get_api_key()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        res = requests.post(url, headers={"Content-Type": "application/json"}, json={"contents": [{"parts": [{"text": prompt}]}]})
        res.raise_for_status()
        answer = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        
        return jsonify({"answer": answer})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate answer."}), 500

from services.presentation_generator import generate_presentation

@app.route("/api/presentation", methods=["POST"])
def presentation():
    """
    Generates a presentation deck based on the session's summary and text.
    Expects JSON: { "session_id": "..." }
    """
    data = request.json or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    session_data = get_session(session_id)
    if not session_data:
        return jsonify({"error": "Invalid or expired session"}), 404

    # Check if already generated
    if session_data.get("presentation"):
        return jsonify({"slides": session_data["presentation"]})

    summary = session_data.get("summary")
    text = session_data.get("text")
    visuals = session_data.get("visuals", [])

    if not summary or not text:
        return jsonify({"error": "Summary or text not available yet"}), 400

    try:
        slides = generate_presentation(summary, text, visuals)
        update_session(session_id, "presentation", slides)
        return jsonify({"slides": slides})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate presentation."}), 500

from services.flashcard_generator import generate_flashcards

@app.route("/api/flashcards", methods=["POST"])
def flashcards():
    """
    Generates study flashcards based on the session's summary and text.
    """
    data = request.json or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    session_data = get_session(session_id)
    if not session_data:
        return jsonify({"error": "Invalid or expired session"}), 404

    if session_data.get("flashcards"):
        return jsonify({"flashcards": session_data["flashcards"]})

    summary = session_data.get("summary")
    chunks = session_data.get("chunks", [])

    if not summary or not chunks:
        return jsonify({"error": "Data not available yet"}), 400

    try:
        cards = generate_flashcards(summary, chunks)
        update_session(session_id, "flashcards", cards)
        return jsonify({"flashcards": cards})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate flashcards."}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
