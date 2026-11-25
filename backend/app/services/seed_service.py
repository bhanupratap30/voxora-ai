from typing import Any

from app.chroma_service import get_knowledge_base_collection

SEED_DOCUMENT_ID = "seed_voxora_products"

DEMO_PRODUCT_DOCS: list[dict[str, Any]] = [
    {
        "id": "seed_voxora_catalog_0",
        "product_name": "Voxora AI Product Catalog",
        "category": "catalog_overview",
        "text": (
            "Voxora AI Sample Product Offerings Overview: "
            "Voxora AI offers five sample AI solutions for businesses: "
            "1. AI Voice Agent: conversational inbound and outbound voice solution in English and Hindi. "
            "2. AI Customer Support Assistant: RAG-based customer support, troubleshooting, and FAQ automation. "
            "3. AI Sales Assistant: lead qualification, budget/timeline collection, buying-signal analysis, and scoring. "
            "4. AI Knowledge Assistant: PDF document ingestion, semantic retrieval, and source-aware answers. "
            "5. AI Appointment Automation: scheduling, availability checking, and demo booking. "
            "Note: These are sample demo offerings; pricing and custom enterprise SLAs are not listed."
        ),
    },
    {
        "id": "seed_voxora_voice_agent_0",
        "product_name": "AI Voice Agent",
        "category": "voice_agent",
        "text": (
            "Sample Product 1: AI Voice Agent. "
            "Description: An AI-powered conversational voice solution for businesses. "
            "Features: Natural inbound and outbound conversations, English and Hindi communication, "
            "speech recognition and voice responses, customer requirement collection, lead qualification and scoring, "
            "sentiment and buying-signal detection, conversation summaries, human follow-up request capture, "
            "and integration with CRM workflows. "
            "Use cases: Enterprise pre-sales, product enquiries, customer support, appointment and demo requests, and lead generation."
        ),
    },
    {
        "id": "seed_voxora_support_0",
        "product_name": "AI Customer Support Assistant",
        "category": "customer_support",
        "text": (
            "Sample Product 2: AI Customer Support Assistant. "
            "Description: An AI-powered customer support solution that understands customer questions and provides answers using company knowledge. "
            "Features: Natural-language customer conversations, RAG-based knowledge retrieval, product documentation lookup, "
            "troubleshooting guidance, FAQ automation, escalation to human support, and conversation history and summaries. "
            "Use cases: Technical product support, laptop and electronics troubleshooting, enterprise customer support, and frequently asked questions."
        ),
    },
    {
        "id": "seed_voxora_sales_0",
        "product_name": "AI Sales Assistant",
        "category": "sales_assistant",
        "text": (
            "Sample Product 3: AI Sales Assistant. "
            "Description: An AI-powered sales assistant that understands customer requirements and helps identify potential sales opportunities. "
            "Features: Lead qualification, budget and purchase timeline collection, decision-maker identification, "
            "buying-signal analysis, lead scoring, customer requirement summaries, and CRM lead management. "
            "Use cases: B2B sales, enterprise product sales, pre-sales qualification, and sales follow-ups."
        ),
    },
    {
        "id": "seed_voxora_knowledge_0",
        "product_name": "AI Knowledge Assistant",
        "category": "knowledge_assistant",
        "text": (
            "Sample Product 4: AI Knowledge Assistant. "
            "Description: An AI assistant that retrieves answers from company documents and internal knowledge sources. "
            "Features: PDF document ingestion, text extraction and chunking, semantic retrieval, context-aware answers, "
            "source-aware responses, unknown-answer handling, and English and Hindi queries. "
            "Use cases: Product manuals, technical documentation, company policies, and internal knowledge management."
        ),
    },
    {
        "id": "seed_voxora_appointment_0",
        "product_name": "AI Appointment Automation",
        "category": "appointment_automation",
        "text": (
            "Sample Product 5: AI Appointment Automation. "
            "Description: An AI-powered scheduling assistant that captures customer preferences and coordinates appointments. "
            "Features: Appointment requests, date and time collection, availability checking, booking confirmation, "
            "cancellation and rescheduling, and appointment records. "
            "Use cases: Product demonstrations, sales consultations, technical consultations, and customer meetings."
        ),
    },
]


def seed_demo_products() -> int:
    """Idempotently seed the 5 Voxora demo product offerings into ChromaDB."""
    collection = get_knowledge_base_collection()
    existing = collection.get(where={"document_id": SEED_DOCUMENT_ID}, include=[])
    existing_ids = set(existing.get("ids") or [])
    if len(existing_ids) == len(DEMO_PRODUCT_DOCS):
        return 0

    to_add = [doc for doc in DEMO_PRODUCT_DOCS if doc["id"] not in existing_ids]
    if not to_add:
        return 0

    collection.add(
        ids=[doc["id"] for doc in to_add],
        documents=[doc["text"] for doc in to_add],
        metadatas=[
            {
                "document_id": SEED_DOCUMENT_ID,
                "filename": "voxora_demo_products.md",
                "source_type": "seeded_demo",
                "product_name": doc["product_name"],
                "category": doc["category"],
                "page_number": 1,
                "chunk_index": idx,
            }
            for idx, doc in enumerate(to_add)
        ],
    )
    return len(to_add)
