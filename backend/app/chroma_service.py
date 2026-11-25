from pathlib import Path
from typing import Any

import chromadb
from chromadb.api.models.Collection import Collection

CHROMA_PERSIST_DIR = Path(__file__).resolve().parents[1] / "data" / "chroma"
COLLECTION_NAME = "voxora_knowledge_base"

_client: chromadb.ClientAPI | None = None
_collection: Collection | None = None


def get_chroma_client() -> chromadb.ClientAPI:
    """Initialize and return the persistent ChromaDB client."""
    global _client
    if _client is None:
        CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
    return _client


def get_knowledge_base_collection() -> Collection:
    """Return the voxora_knowledge_base collection with cosine similarity."""
    global _collection
    if _collection is None:
        client = get_chroma_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def get_total_chunks() -> int:
    """Return the total number of stored document chunks."""
    collection = get_knowledge_base_collection()
    return collection.count()


def get_knowledge_base_status() -> dict[str, Any]:
    """Check ChromaDB connection, collection availability, and chunk count."""
    try:
        collection = get_knowledge_base_collection()
        total_chunks = collection.count()
        return {
            "status": "connected",
            "collection_name": collection.name,
            "total_chunks": total_chunks,
        }
    except Exception as exc:
        return {
            "status": "error",
            "collection_name": COLLECTION_NAME,
            "total_chunks": 0,
            "detail": f"{type(exc).__name__}: {exc}",
        }
