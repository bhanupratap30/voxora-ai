from io import BytesIO
from pathlib import Path
import uuid
from typing import Any

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.chroma_service import get_knowledge_base_collection

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150


class DocumentValidationError(ValueError):
    """Raised when an uploaded PDF fails validation."""


def _sanitize_filename(filename: str | None) -> str:
    """Return a safe display filename without directory components."""
    name = Path(filename or "document.pdf").name.strip()
    return name or "document.pdf"


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping character chunks."""
    cleaned = " ".join(text.split())
    if not cleaned:
        return []

    chunks: list[str] = []
    start = 0
    step = max(1, chunk_size - overlap)
    while start < len(cleaned):
        end = start + chunk_size
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start += step
    return chunks


def process_and_store_pdf(filename: str | None, content: bytes) -> dict[str, Any]:
    """Validate, extract, chunk, and store a PDF in ChromaDB."""
    safe_name = _sanitize_filename(filename)
    if not safe_name.lower().endswith(".pdf"):
        raise DocumentValidationError("Only .pdf files are supported.")

    if not content:
        raise DocumentValidationError("Uploaded PDF file is empty.")

    if len(content) > MAX_PDF_BYTES:
        raise DocumentValidationError("PDF file exceeds the 10 MB size limit.")

    if not content.lstrip().startswith(b"%PDF-"):
        raise DocumentValidationError("Invalid PDF file content.")

    try:
        reader = PdfReader(BytesIO(content))
    except (PdfReadError, Exception) as exc:
        raise DocumentValidationError("Unable to read PDF file.") from exc

    if reader.is_encrypted:
        raise DocumentValidationError(
            "Password-protected PDFs are not supported."
        )

    chunks_data: list[tuple[str, int, int]] = []
    chunk_index = 0

    for page_num, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except Exception as exc:
            raise DocumentValidationError(
                f"Failed to extract text from page {page_num}."
            ) from exc

        for chunk in _chunk_text(page_text):
            chunks_data.append((chunk, page_num, chunk_index))
            chunk_index += 1

    if not chunks_data:
        raise DocumentValidationError(
            "No extractable text was found in the PDF."
        )

    document_id = str(uuid.uuid4())
    collection = get_knowledge_base_collection()

    ids = [f"{document_id}_{idx}" for _, _, idx in chunks_data]
    documents = [text for text, _, _ in chunks_data]
    metadatas = [
        {
            "document_id": document_id,
            "filename": safe_name,
            "page_number": page_num,
            "chunk_index": idx,
        }
        for _, page_num, idx in chunks_data
    ]

    try:
        collection.add(ids=ids, documents=documents, metadatas=metadatas)
    except Exception:
        try:
            collection.delete(where={"document_id": document_id})
        except Exception:
            pass
        raise

    return {
        "document_id": document_id,
        "filename": safe_name,
        "status": "ready",
        "chunk_count": len(chunks_data),
    }


def list_documents() -> list[dict[str, Any]]:
    """List all uploaded documents with their chunk counts."""
    collection = get_knowledge_base_collection()
    result = collection.get(include=["metadatas"])
    metadatas = result.get("metadatas") or []

    docs_map: dict[str, dict[str, Any]] = {}
    for meta in metadatas:
        if not meta:
            continue
        doc_id = meta.get("document_id")
        if not doc_id:
            continue
        if doc_id not in docs_map:
            docs_map[doc_id] = {
                "document_id": doc_id,
                "filename": meta.get("filename", "unknown.pdf"),
                "status": "ready",
                "chunk_count": 0,
            }
        docs_map[doc_id]["chunk_count"] += 1

    return list(docs_map.values())


def delete_document(document_id: str) -> int:
    """Delete all chunks associated with a document_id."""
    collection = get_knowledge_base_collection()
    existing = collection.get(where={"document_id": document_id}, include=[])
    existing_ids = existing.get("ids") or []
    if not existing_ids:
        raise FileNotFoundError(f"Document '{document_id}' not found.")

    collection.delete(where={"document_id": document_id})
    return len(existing_ids)
