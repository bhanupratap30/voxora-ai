from typing import Any

from app.chroma_service import get_knowledge_base_collection

DEFAULT_TOP_K = 3
MAX_COSINE_DISTANCE = 0.75


def retrieve_relevant_chunks(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    max_distance: float = MAX_COSINE_DISTANCE,
) -> dict[str, Any]:
    """Query ChromaDB for top-k relevant chunks within the cosine distance threshold."""
    collection = get_knowledge_base_collection()
    total = collection.count()
    if total == 0:
        return {
            "chunks": [],
            "sources": [],
            "pages": [],
            "rag_used": False,
        }

    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, total),
        include=["documents", "metadatas", "distances"],
    )

    docs = (results.get("documents") or [[]])[0]
    metas = (results.get("metadatas") or [[]])[0]
    distances = (results.get("distances") or [[]])[0]

    chunks: list[str] = []
    sources: list[str] = []
    pages: list[int] = []

    for doc, meta, dist in zip(docs, metas, distances):
        if dist is not None and dist > max_distance:
            continue
        if not doc:
            continue

        chunks.append(doc)
        if meta:
            filename = meta.get("filename")
            if filename and filename not in sources:
                sources.append(filename)
            page_num = meta.get("page_number")
            if isinstance(page_num, int) and page_num not in pages:
                pages.append(page_num)

    pages.sort()
    return {
        "chunks": chunks,
        "sources": sources,
        "pages": pages,
        "rag_used": len(chunks) > 0,
    }
