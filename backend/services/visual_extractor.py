"""
visual_extractor.py
-------------------
Extracts images/figures from the PDF using PyMuPDF and ranks them based on relevance.
"""

import os
import fitz  # PyMuPDF
import uuid
from typing import List, Dict

def extract_visuals(file_bytes: bytes, static_dir: str) -> List[Dict]:
    """
    Extract images from a PDF and save them to static_dir.
    Returns a list of visual metadata.
    """
    visuals = []
    
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            image_list = page.get_images(full=True)
            
            # Get text on this page to use as rough "context" or caption
            page_text = page.get_text()
            context = page_text[:200].replace("\n", " ") + "..." # Just taking a snippet for now
            
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Filter out very small images (likely icons or noise)
                if len(image_bytes) < 10000:
                    continue
                    
                filename = f"{uuid.uuid4().hex}.{image_ext}"
                filepath = os.path.join(static_dir, filename)
                
                # Ensure the directory exists before saving
                os.makedirs(static_dir, exist_ok=True)
                
                with open(filepath, "wb") as f:
                    f.write(image_bytes)
                
                visuals.append({
                    "id": filename,
                    "url": f"/static/visuals/{filename}",
                    "page_number": page_num + 1,
                    "caption": f"Figure extracted from Page {page_num + 1}",
                    "context": context
                })
                
                if len(visuals) >= 4: # limit to top 4 images for simplicity
                    return visuals
                    
    except Exception as e:
        print(f"[VisualExtractor] Failed to extract visuals: {e}")
        
    return visuals
