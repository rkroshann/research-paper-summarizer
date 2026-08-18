"""
rag_engine.py
-------------
Handles text chunking, embedding generation using Gemini API,
and retrieving the most relevant chunks using cosine similarity.
"""

import numpy as np
import requests
import json
from typing import List
from services.summarizer import get_api_key

def chunk_text(pages: List[str], chunk_size: int = 500, overlap: int = 100) -> List[str]:
    # Chunking logic that preserves page numbers
    chunks = []
    for page_num, text in enumerate(pages):
        words = text.split()
        i = 0
        while i < len(words):
            chunk_body = " ".join(words[i:i + chunk_size])
            # Append page metadata so the LLM knows where this came from
            chunk_with_meta = f"[Source: Page {page_num + 1}]\n{chunk_body}"
            chunks.append(chunk_with_meta)
            i += chunk_size - overlap
    return chunks

def generate_embeddings(texts: List[str]) -> np.ndarray:
    api_key = get_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing.")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    requests_payload = [
        {
            "model": "models/gemini-embedding-2",
            "content": {"parts": [{"text": text}]}
        }
        for text in texts
    ]
    
    # Gemini has a limit on batch size, let's chunk the requests if there are too many
    BATCH_SIZE = 100
    all_embeddings = []
    
    for i in range(0, len(requests_payload), BATCH_SIZE):
        batch = requests_payload[i:i + BATCH_SIZE]
        payload = {"requests": batch}
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        if "embeddings" not in data:
            print("[RAG] Warning: unexpected response from embeddings API:", data)
            # fallback
            return np.zeros((len(texts), 768), dtype=np.float32)
            
        for item in data["embeddings"]:
            all_embeddings.append(item["values"])
    
    return np.array(all_embeddings, dtype=np.float32)

def generate_embedding(text: str) -> np.ndarray:
    return generate_embeddings([text])[0]

def retrieve_relevant_chunks(query: str, chunks: List[str], embeddings: np.ndarray, top_k: int = 4) -> List[str]:
    if len(chunks) == 0 or embeddings is None or len(embeddings) == 0:
        return []
    
    query_emb = generate_embedding(query)
    
    query_norm = np.linalg.norm(query_emb)
    emb_norms = np.linalg.norm(embeddings, axis=1)
    
    similarities = np.dot(embeddings, query_emb) / (emb_norms * query_norm + 1e-10)
    
    top_indices = np.argsort(similarities)[::-1][:top_k]
    
    return [chunks[i] for i in top_indices if similarities[i] > 0.3]  # simple threshold
