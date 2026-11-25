# Voxora AI

AI-powered sales voice agent built with **React + Vite**, **Python + FastAPI**, and the **Groq API**.

## Project Structure

```text
voxora-ai/
├── backend/
│   ├── app/
│   │   └── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .env.example
├── .gitignore
└── README.md
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your `GROQ_API_KEY`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Project Report

### 1. Project Overview
**Voxora AI** is an AI-powered sales voice agent and intelligent CRM platform designed to automate inbound and outbound sales conversations in **English** and **Hindi**. It listens to customers via browser-based voice recognition, answers product questions using company documentation, qualifies leads in real time, detects customer sentiment and buying signals, books demo appointments, and summarizes every call into a persistent sales dashboard.

### 2. Technologies Used
- **Frontend**: React 19, Vite 6, React Router DOM, Axios, Lucide React, Web Speech API (`SpeechRecognition` & `speechSynthesis`)
- **Backend**: Python 3.12, FastAPI, Uvicorn
- **LLM & AI**: Groq API (`openai/gpt-oss-120b` / `llama-3.3-70b-versatile`)
- **Vector Database & RAG**: ChromaDB (persistent local storage at `backend/data/chroma/`) + `pypdf`
- **Relational Database**: PostgreSQL 18 + SQLAlchemy + `psycopg`

### 3. System Architecture
1. **Presentation Layer (React + Vite)**: Captures voice or text input on the Voice Agent page, sends `POST /api/chat` requests with a persistent `session_id`, and displays live transcripts, qualification progress, sentiment alerts, and booked appointments alongside management pages for Dashboard, Leads, Knowledge Base, Appointments, Call History, and Analytics.
2. **Application & AI Layer (FastAPI)**:
   - `groq_service.py`: Orchestrates responses using RAG context, lead qualification state, booking state, and conversation history.
   - `rag_service.py` & `document_service.py`: Extracts text from uploaded PDFs, chunks it, and retrieves the top-3 relevant chunks from ChromaDB.
   - `lead_service.py`: Deterministically extracts customer details and computes a 0–100 lead score.
   - `sentiment_service.py`: Classifies customer sentiment, emotion, intent, buying signal, urgency, and human-escalation need.
   - `appointment_service.py`: Validates dates/times, prevents overlapping 30-minute bookings, and persists confirmed demos.
   - `call_service.py` & `analytics_service.py`: Tracks call lifecycle, generates AI call summaries, and aggregates live sales analytics.
3. **Data Layer**: PostgreSQL 18 (`leads`, `appointments`, `calls`) and ChromaDB (`voxora_knowledge_base`).

### 4. How CRM Helps in This Project
- **Zero-Loss Memory**: Every conversation is linked to a unique `session_id` in `leads`, preventing repeated questions and recovering state across backend restarts.
- **Deterministic Lead Scoring**: Automatically scores leads (`0–100`) and classifies them as **Hot** (`70–100`), **Warm** (`40–69`), or **Cold** (`0–39`) from verified fields.
- **Human Handoff & Follow-Ups**: Records `human_followup_requested` and `followup_status` when escalation is needed.
- **Unified Pipeline**: Links leads to **Appointments** and **Call History** (`lead_id`) for complete sales context.

### 5. How RAG Works
1. **Ingestion**: Uploaded PDFs are parsed page by page with `pypdf`, split into ~800-character chunks with 150-character overlap, and stored in ChromaDB with `document_id`, `filename`, and `page_number` metadata.
2. **Retrieval**: Customer queries search `voxora_knowledge_base` via semantic similarity, returning up to the **top 3** chunks within a cosine distance threshold (`0.75`).
3. **Grounded Generation**: Retrieved chunks are injected into Groq's prompt as reference data so the AI answers accurately without inventing prices or features.

### 6. Future Scope
- **Telephony & Omnichannel Integration**: Twilio/WebRTC/SIP phone calls, WhatsApp, and embeddable web widgets.
- **External Email & Calendar Sync**: Automated SMTP/SendGrid notifications and Google Calendar/Outlook invites.
- **Authentication & Multi-Tenancy**: User login, role-based access control, and per-organization workspaces.
- **Cloud-Native TTS/STT**: Optional neural voice providers (e.g., ElevenLabs, Deepgram) for ultra-low-latency streaming audio.
- **External CRM Sync**: Two-way webhooks/integrations with HubSpot or Salesforce.
