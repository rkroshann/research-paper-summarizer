"""
storage.py
----------
In-memory session storage for the Paper Summarizer.
Stores extracted text, chunks, embeddings, visuals, and metadata per session.
"""

import uuid
from typing import Dict, Any

_SESSIONS: Dict[str, Dict[str, Any]] = {}

def create_session() -> str:
    session_id = str(uuid.uuid4())
    _SESSIONS[session_id] = {
        "text": "",
        "metadata": {},
        "chunks": [],
        "embeddings": None,
        "visuals": [],
        "summary": None,
        "knowledge_graph": None,
        "podcast_script": None,
        "podcast_audio_path": None,
    }
    return session_id

def get_session(session_id: str) -> Dict[str, Any]:
    return _SESSIONS.get(session_id)

def update_session(session_id: str, key: str, value: Any):
    if session_id in _SESSIONS:
        _SESSIONS[session_id][key] = value

def delete_session(session_id: str):
    if session_id in _SESSIONS:
        del _SESSIONS[session_id]
