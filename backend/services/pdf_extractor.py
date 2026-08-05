"""
pdf_extractor.py
----------------
Stage 1 of the pipeline: "Upload & Extract"

Takes a PDF file (path or file-like object) and returns the raw
extracted text, page by page, plus some light metadata.
"""

import pdfplumber


def extract_text_from_pdf(file_obj_or_path) -> dict:
    """
    Extract raw text from a research paper PDF.

    Args:
        file_obj_or_path: a file path (str) or a file-like object
                           (e.g. Flask's request.files['file'])

    Returns:
        dict with:
            - "full_text": str, all pages concatenated
            - "pages": list[str], text per page
            - "num_pages": int
    """
    pages_text = []

    with pdfplumber.open(file_obj_or_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages_text.append(text)

    full_text = "\n".join(pages_text)

    return {
        "full_text": full_text,
        "pages": pages_text,
        "num_pages": len(pages_text),
    }


def basic_validation(extracted: dict) -> None:
    """
    Raise a ValueError if the extracted text looks unusable
    (e.g. a scanned/image-only PDF with no selectable text).
    """
    if not extracted["full_text"] or len(extracted["full_text"].strip()) < 200:
        raise ValueError(
            "Could not extract readable text from this PDF. "
            "It may be a scanned/image-only document that requires OCR."
        )
