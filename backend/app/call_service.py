from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.call import Call
from app.models.lead import Lead

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_BACKEND_ENV_PATH)

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
ALLOWED_CALL_STATUSES = {"in_progress", "completed", "abandoned", "failed"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def start_call(db: Session, session_id: str) -> Call:
    """Start or retrieve an existing call session."""
    sid = (session_id or "default").strip() or "default"
    existing = db.query(Call).filter(Call.session_id == sid).first()
    if existing is not None:
        return existing

    call = Call(session_id=sid, started_at=_utcnow(), status="in_progress", transcript=[])
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def append_call_message(
    db: Session,
    session_id: str,
    speaker: str,
    message: str,
    time_label: str | None = None,
) -> Call:
    """Append a customer or AI message to the call transcript."""
    call = start_call(db, session_id)
    if call.status != "in_progress":
        return call

    transcript = list(call.transcript or [])
    transcript.append(
        {
            "speaker": speaker.strip().lower(),
            "message": message.strip(),
            "time": time_label or _utcnow().strftime("%H:%M"),
        }
    )
    call.transcript = transcript
    db.commit()
    db.refresh(call)
    return call


def generate_call_summary(transcript: list[dict[str, Any]]) -> dict[str, str]:
    """Generate a concise structured summary from a call transcript using Groq."""
    if not transcript:
        return {
            "summary": "No conversation messages were recorded.",
            "key_requirements": "None captured.",
            "objections": "None raised.",
            "next_steps": "Follow up with customer.",
        }

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return {
            "summary": f"Call with {len(transcript)} message(s) recorded.",
            "key_requirements": "Pending review.",
            "objections": "Pending review.",
            "next_steps": "Review transcript and follow up.",
        }

    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL
    formatted = "\n".join(
        f"{item.get('speaker', 'unknown')}: {item.get('message', '')}"
        for item in transcript
    )

    prompt = (
        "Summarize this sales call transcript as a JSON object with exact keys:\n"
        '- "summary": concise overview including questions asked and buying signals\n'
        '- "key_requirements": customer requirements\n'
        '- "objections": customer objections or concerns\n'
        '- "next_steps": agreed next steps and recommended follow-up\n'
        "Respond with JSON only."
    )

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": formatted},
            ],
            response_format={"type": "json_object"},
        )
        parsed = json.loads(completion.choices[0].message.content or "{}")
        return {
            "summary": str(parsed.get("summary") or "Call completed."),
            "key_requirements": str(parsed.get("key_requirements") or "None specified."),
            "objections": str(parsed.get("objections") or "None raised."),
            "next_steps": str(parsed.get("next_steps") or "Follow up with customer."),
        }
    except Exception:
        return {
            "summary": f"Call completed with {len(transcript)} message(s).",
            "key_requirements": "See transcript.",
            "objections": "See transcript.",
            "next_steps": "Follow up with customer.",
        }


def end_call(db: Session, session_id: str, status: str = "completed") -> Call:
    """End a call session idempotently, calculate duration, link lead, and generate summary."""
    call = start_call(db, session_id)
    if call.status in {"completed", "abandoned", "failed"} and call.ended_at is not None:
        return call

    clean_status = status.strip().lower()
    if clean_status not in {"completed", "abandoned", "failed"}:
        clean_status = "completed"

    now = _utcnow()
    started = call.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    duration = max(0, int((now - started).total_seconds()))

    lead = db.query(Lead).filter(Lead.session_id == call.session_id).first()
    if lead is not None:
        call.lead_id = lead.id
        call.customer_name = lead.customer_name
        call.company_name = lead.company_name
        call.sentiment = lead.sentiment
        call.intent = lead.intent
        call.lead_score = lead.lead_score
        call.lead_category = lead.lead_category

    summary_data = generate_call_summary(call.transcript or [])
    call.ended_at = now
    call.duration_seconds = duration
    call.status = clean_status
    call.summary = summary_data["summary"]
    call.key_requirements = summary_data["key_requirements"]
    call.objections = summary_data["objections"]
    call.next_steps = summary_data["next_steps"]

    db.commit()
    db.refresh(call)
    return call


def list_calls(
    db: Session,
    search: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Call], int]:
    """List calls with optional search and status filter."""
    query = db.query(Call)
    if status and status in ALLOWED_CALL_STATUSES:
        query = query.filter(Call.status == status)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Call.customer_name.ilike(term),
                Call.company_name.ilike(term),
                Call.summary.ilike(term),
            )
        )
    total = query.count()
    items = query.order_by(Call.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def get_call(db: Session, call_id: int) -> Call | None:
    """Retrieve a single call by ID."""
    return db.query(Call).filter(Call.id == call_id).first()
