import logging
from contextlib import asynccontextmanager
from datetime import date, time
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.analytics_service import get_analytics
from app.auth_service import (
    VALID_ROLES,
    ensure_user_onboarded,
    get_current_user,
    get_current_workspace,
    record_admin_audit,
    require_role,
    require_super_admin,
)
from app.models.auth import (
    AdminAuditLog,
    UserProfile,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
)
from app.appointment_service import (
    AppointmentConflictError,
    AppointmentValidationError,
    cancel_appointment,
    check_slot_availability,
    create_appointment,
    get_appointment,
    list_appointments,
    update_appointment,
)
from app.call_service import (
    append_call_message,
    end_call,
    get_call,
    list_calls,
    start_call,
)
from app.chroma_service import get_knowledge_base_status
from app.database import get_db, get_session_local, init_db
from app.models.appointment import Appointment
from app.models.call import Call
from app.models.lead import Lead
from app.services.document_service import (
    DocumentValidationError,
    delete_document,
    list_documents,
    process_and_store_pdf,
)
from app.services.groq_service import generate_chat_reply
from app.services.seed_service import seed_demo_products


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize database tables and seed demo product knowledge base on startup."""
    init_db()
    try:
        seed_demo_products()
    except Exception:
        pass
    yield


app = FastAPI(title="Voxora AI API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """Request payload for /api/chat."""

    message: str = Field(..., min_length=1, max_length=4000)
    language: str = Field(default="English", max_length=32)
    session_id: str = Field(default="default", max_length=64)

    @field_validator("message")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        """Ensure the message is not only whitespace."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message cannot be empty.")
        return cleaned


class ChatResponse(BaseModel):
    """Response payload for /api/chat."""

    reply: str
    model: str
    rag_used: bool = False
    retrieved_chunks: int = 0
    sources: list[str] = []
    pages: list[int] = []
    qualification_progress: int = 0
    collected_fields: dict[str, str] = {}
    missing_fields: list[str] = []
    lead_score: int = 0
    lead_category: str = "Cold"
    qualification_complete: bool = False
    sentiment: str = "neutral"
    emotion: str = "unknown"
    intent: str = "general_inquiry"
    buying_signal: str = "low"
    urgency: str = "low"
    requires_human: bool = False
    sentiment_reason: str = ""
    appointment: dict | None = None


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok", "service": "voxora-ai-backend"}


@app.get("/api/knowledge-base/status")
async def knowledge_base_status() -> dict:
    """Return ChromaDB connection status, collection name, and total chunks."""
    return get_knowledge_base_status()


@app.post("/api/knowledge-base/upload")
async def upload_knowledge_base_pdf(file: UploadFile = File(...)) -> dict:
    """Upload, extract, chunk, and store a PDF in ChromaDB."""
    try:
        content = await file.read()
        return process_and_store_pdf(file.filename, content)
    except DocumentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {type(exc).__name__}",
        ) from exc


@app.get("/api/knowledge-base/documents")
async def get_knowledge_base_documents() -> dict:
    """List all uploaded Knowledge Base documents."""
    try:
        return {"documents": list_documents()}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list documents: {type(exc).__name__}",
        ) from exc


@app.delete("/api/knowledge-base/documents/{document_id}")
async def remove_knowledge_base_document(document_id: str) -> dict:
    """Delete a Knowledge Base document and all its chunks."""
    try:
        deleted_chunks = delete_document(document_id)
        return {
            "status": "deleted",
            "document_id": document_id,
            "deleted_chunks": deleted_chunks,
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc



    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {type(exc).__name__}",
        ) from exc


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    ctx: dict = Depends(get_current_workspace),
) -> ChatResponse:
    """Send a user message to Groq with RAG context and return the AI response."""
    logger = logging.getLogger("voxora.voice")
    logger.info("REQUEST RECEIVED: /api/chat")
    logger.info("SESSION IDENTIFIED: %s", payload.session_id)
    try:
        reply, model, meta = await run_in_threadpool(
            generate_chat_reply,
            payload.message,
            payload.language,
            payload.session_id,
            ctx["workspace_id"],
        )
        logger.info("RESPONSE SENT TO FRONTEND: session=%s", payload.session_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Chat processing failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail=f"Groq API request failed: {type(exc).__name__}",
        ) from exc

    return ChatResponse(reply=reply, model=model, **meta)


class LeadUpdateRequest(BaseModel):
    """Request payload for PATCH /api/leads/{lead_id}."""

    status: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


def _serialize_lead(lead: Lead) -> dict:
    return {
        "id": lead.id,
        "session_id": lead.session_id,
        "customer_name": lead.customer_name,
        "company_name": lead.company_name,
        "business_type": lead.business_type,
        "requirements": lead.requirements,
        "monthly_call_volume": lead.monthly_call_volume,
        "budget": lead.budget,
        "purchase_timeline": lead.purchase_timeline,
        "decision_authority": lead.decision_authority,
        "lead_score": lead.lead_score,
        "lead_category": lead.lead_category,
        "qualification_progress": lead.qualification_progress,
        "qualification_complete": lead.qualification_complete,
        "status": lead.status,
        "notes": lead.notes,
        "sentiment": lead.sentiment,
        "emotion": lead.emotion,
        "intent": lead.intent,
        "buying_signal": lead.buying_signal,
        "urgency": lead.urgency,
        "requires_human": lead.requires_human,
        "sentiment_reason": lead.sentiment_reason,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


@app.get("/api/leads")
async def list_leads(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=128),
    category: str | None = Query(default=None, max_length=32),
    ctx: dict = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """List persisted CRM leads scoped to the active workspace."""
    query = db.query(Lead).filter(Lead.workspace_id == ctx["workspace_id"])
    if category and category in {"Hot", "Warm", "Cold"}:
        query = query.filter(Lead.lead_category == category)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.customer_name.ilike(term),
                Lead.company_name.ilike(term),
                Lead.business_type.ilike(term),
            )
        )

    total = query.count()
    leads = (
        query.order_by(Lead.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"leads": [_serialize_lead(item) for item in leads], "total": total}


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: int, db: Session = Depends(get_db)) -> dict:
    """Retrieve a single lead's details."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return _serialize_lead(lead)


@app.patch("/api/leads/{lead_id}")
async def update_lead(
    lead_id: int,
    payload: LeadUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Update a lead's CRM status or notes."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found.")

    if payload.status is not None:
        lead.status = payload.status.strip() or lead.status
    if payload.notes is not None:
        lead.notes = payload.notes.strip()

    db.commit()
    db.refresh(lead)
    return _serialize_lead(lead)


@app.get("/api/leads/{lead_id}/insights")
async def get_lead_insights(lead_id: int, db: Session = Depends(get_db)) -> dict:
    """Retrieve sentiment and intent insights for a lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return {
        "lead_id": lead.id,
        "sentiment": lead.sentiment,
        "emotion": lead.emotion,
        "intent": lead.intent,
        "buying_signal": lead.buying_signal,
        "urgency": lead.urgency,
        "requires_human": lead.requires_human,
        "sentiment_reason": lead.sentiment_reason,
    }


class AppointmentCreateRequest(BaseModel):
    """Request payload for POST /api/appointments."""

    lead_id: int | None = None
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    company_name: str | None = Field(default=None, max_length=255)
    appointment_date: date
    start_time: time
    end_time: time | None = None
    timezone: str = Field(default="Asia/Kolkata", max_length=64)
    meeting_type: str = Field(default="online", max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


class AvailabilityCheckRequest(BaseModel):
    """Request payload for POST /api/appointments/availability."""

    appointment_date: date
    start_time: time
    end_time: time | None = None


class AppointmentUpdateRequest(BaseModel):
    """Request payload for PATCH /api/appointments/{appointment_id}."""

    status: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


def _serialize_appointment(appt: Appointment) -> dict:
    return {
        "id": appt.id,
        "workspace_id": appt.workspace_id,
        "lead_id": appt.lead_id,
        "customer_name": appt.customer_name,
        "customer_email": appt.customer_email,
        "phone": appt.phone,
        "company_name": appt.company_name,
        "appointment_date": appt.appointment_date.isoformat(),
        "start_time": appt.start_time.strftime("%H:%M"),
        "end_time": appt.end_time.strftime("%H:%M"),
        "timezone": appt.timezone,
        "status": appt.status,
        "meeting_type": appt.meeting_type,
        "notes": appt.notes,
        "created_at": appt.created_at.isoformat() if appt.created_at else None,
        "updated_at": appt.updated_at.isoformat() if appt.updated_at else None,
    }


@app.get("/api/appointments")
async def get_appointments(
    status: str | None = Query(default=None, max_length=32),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    ctx: dict = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """List appointments scoped to the active workspace."""
    items, total = list_appointments(
        db, workspace_id=ctx["workspace_id"], status=status, skip=skip, limit=limit
    )
    return {"appointments": [_serialize_appointment(item) for item in items], "total": total}


@app.post("/api/appointments/availability")
async def post_appointment_availability(
    payload: AvailabilityCheckRequest,
    _ctx: dict = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """Check slot availability and suggest alternatives if unavailable."""
    try:
        return check_slot_availability(
            db, payload.appointment_date, payload.start_time, payload.end_time
        )
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/appointments/availability")
async def get_appointment_availability(
    appointment_date: date = Query(...),
    start_time: time = Query(...),
    end_time: time | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Check slot availability and suggest alternatives if unavailable."""
    try:
        return check_slot_availability(db, appointment_date, start_time, end_time)
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/appointments/{appointment_id}")
async def get_appointment_detail(
    appointment_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Retrieve a single appointment's details."""
    appt = get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return _serialize_appointment(appt)


@app.post("/api/appointments", status_code=201)
async def create_new_appointment(
    payload: AppointmentCreateRequest,
    ctx: dict = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """Create a new scheduled appointment."""
    try:
        appt = create_appointment(
            db,
            customer_name=payload.customer_name,
            appointment_date=payload.appointment_date,
            start_time=payload.start_time,
            end_time=payload.end_time,
            company_name=payload.company_name,
            customer_email=payload.customer_email,
            phone=payload.phone,
            timezone=payload.timezone,
            lead_id=payload.lead_id,
            workspace_id=ctx["workspace_id"],
            meeting_type=payload.meeting_type,
            notes=payload.notes,
        )
        return _serialize_appointment(appt)
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AppointmentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.patch("/api/appointments/{appointment_id}")
async def patch_appointment(
    appointment_id: int,
    payload: AppointmentUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Update an appointment's status or notes."""
    try:
        appt = update_appointment(
            db,
            appointment_id,
            status=payload.status,
            notes=payload.notes,
        )
        return _serialize_appointment(appt)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Cancel an appointment."""
    try:
        appt = cancel_appointment(db, appointment_id)
        return _serialize_appointment(appt)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/dashboard")
async def get_dashboard_summary() -> dict:
    """Return aggregated dashboard metrics, analytics, recent calls, and activity."""
    empty_payload = {
        "db_connected": False,
        "total_calls": 0,
        "total_leads": 0,
        "qualified_leads": 0,
        "total_appointments": 0,
        "calls_over_time": [],
        "lead_breakdown": {"qualified": 0, "unqualified": 0},
        "recent_calls": [],
        "recent_activity": [],
    }
    session_factory = get_session_local()
    if session_factory is None:
        return empty_payload

    db = session_factory()
    try:
        leads = db.query(Lead).order_by(Lead.updated_at.desc()).all()
        appointments = db.query(Appointment).order_by(Appointment.updated_at.desc()).all()
        completed_calls = (
            db.query(Call)
            .filter(Call.status == "completed")
            .order_by(Call.created_at.desc())
            .all()
        )

        total_leads = len(leads)
        qualified_leads = sum(
            1 for item in leads if item.qualification_complete or item.lead_score >= 40
        )
        unqualified_leads = total_leads - qualified_leads

        date_counts: dict[str, int] = {}
        for item in completed_calls:
            day = item.created_at.date().isoformat() if item.created_at else "unknown"
            date_counts[day] = date_counts.get(day, 0) + 1

        calls_over_time = [
            {"date": day, "calls": count}
            for day, count in sorted(date_counts.items())
        ]

        def _fmt_dur(secs: int) -> str:
            mins, rem = divmod(max(0, secs), 60)
            return f"{mins}m {rem}s" if mins else f"{rem}s"

        recent_calls = [
            {
                "id": item.id,
                "customer_name": item.customer_name or "Unknown",
                "company_name": item.company_name or "--",
                "date": item.created_at.date().isoformat() if item.created_at else "--",
                "duration": _fmt_dur(item.duration_seconds),
                "sentiment": item.sentiment or "neutral",
                "outcome": item.lead_category or "Cold",
            }
            for item in completed_calls[:5]
        ]

        recent_activity = []
        for item in leads[:3]:
            recent_activity.append(
                {
                    "type": "lead",
                    "title": f"Lead: {item.customer_name or 'Unknown'} ({item.lead_category})",
                    "date": item.updated_at.isoformat() if item.updated_at else "",
                }
            )
        for appt in appointments[:3]:
            recent_activity.append(
                {
                    "type": "appointment",
                    "title": f"Demo: {appt.customer_name} on {appt.appointment_date.isoformat()}",
                    "date": appt.updated_at.isoformat() if appt.updated_at else "",
                }
            )
        recent_activity.sort(key=lambda x: x["date"], reverse=True)

        return {
            "db_connected": True,
            "total_calls": len(completed_calls),
            "total_leads": total_leads,
            "qualified_leads": qualified_leads,
            "total_appointments": len(appointments),
            "calls_over_time": calls_over_time,
            "lead_breakdown": {
                "qualified": qualified_leads,
                "unqualified": unqualified_leads,
            },
            "recent_calls": recent_calls,
            "recent_activity": recent_activity[:5],
        }
    except Exception:
        return empty_payload
    finally:
        db.close()


class CallStartRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)


class CallMessageRequest(BaseModel):
    speaker: str = Field(..., min_length=1, max_length=32)
    message: str = Field(..., min_length=1, max_length=4000)
    time: str | None = Field(default=None, max_length=32)


class CallEndRequest(BaseModel):
    status: str = Field(default="completed", max_length=32)


def _serialize_call(call: Call) -> dict:
    return {
        "id": call.id,
        "session_id": call.session_id,
        "lead_id": call.lead_id,
        "customer_name": call.customer_name,
        "company_name": call.company_name,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds,
        "status": call.status,
        "transcript": call.transcript or [],
        "summary": call.summary,
        "sentiment": call.sentiment,
        "intent": call.intent,
        "lead_score": call.lead_score,
        "lead_category": call.lead_category,
        "key_requirements": call.key_requirements,
        "objections": call.objections,
        "next_steps": call.next_steps,
        "created_at": call.created_at.isoformat() if call.created_at else None,
    }


@app.post("/api/calls/start")
async def start_call_endpoint(
    payload: CallStartRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Start or resume a call session."""
    call = start_call(db, payload.session_id)
    return _serialize_call(call)


@app.post("/api/calls/{session_id}/messages")
async def append_call_message_endpoint(
    session_id: str,
    payload: CallMessageRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Append a message to a call session transcript."""
    call = append_call_message(
        db, session_id, payload.speaker, payload.message, payload.time
    )
    return _serialize_call(call)


@app.post("/api/calls/{session_id}/end")
async def end_call_endpoint(
    session_id: str,
    payload: CallEndRequest | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """End a call session idempotently and generate an AI summary."""
    status_val = payload.status if payload else "completed"
    call = end_call(db, session_id, status=status_val)
    return _serialize_call(call)


@app.get("/api/calls")
async def list_calls_endpoint(
    search: str | None = Query(default=None, max_length=128),
    status: str | None = Query(default=None, max_length=32),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    """List call history with pagination and optional search/status filters."""
    items, total = list_calls(db, search=search, status=status, skip=skip, limit=limit)
    return {"calls": [_serialize_call(item) for item in items], "total": total}


@app.get("/api/calls/{call_id}")
async def get_call_endpoint(call_id: int, db: Session = Depends(get_db)) -> dict:
    """Retrieve a single call's details, transcript, and AI summary."""
    call = get_call(db, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Call not found.")
    return _serialize_call(call)


@app.get("/api/analytics")
async def get_analytics_endpoint(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    ctx: dict = Depends(require_role({"OWNER", "ADMIN", "MANAGER"})),
    db: Session = Depends(get_db),
) -> dict:
    """Return sales analytics and AI-generated insights from PostgreSQL."""
    return get_analytics(db, start_date=start_date, end_date=end_date)


class OnboardRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    account_type: str = Field(default="individual", max_length=32)
    company_name: str | None = Field(default=None, max_length=255)


class InviteRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: str = Field(default="SALES_AGENT", max_length=32)


@app.post("/api/auth/onboard")
async def onboard_user(
    payload: OnboardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Idempotently onboard an authenticated Supabase user into a personal or company workspace."""
    return ensure_user_onboarded(
        db,
        user,
        full_name=payload.full_name,
        account_type=payload.account_type,
        company_name=payload.company_name,
    )


@app.get("/api/auth/me")
async def get_me(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Return the authenticated user's profile and workspaces."""
    return ensure_user_onboarded(db, user)


@app.post("/api/workspaces/invite")
async def invite_workspace_member(
    payload: InviteRequest,
    ctx: dict = Depends(require_role({"OWNER", "ADMIN"})),
    db: Session = Depends(get_db),
) -> dict:
    """Invite a member to the active company workspace."""
    role = payload.role.strip().upper()
    if role not in VALID_ROLES or role == "OWNER":
        raise HTTPException(status_code=400, detail="Invalid role for invitation.")
    inv = WorkspaceInvitation(
        workspace_id=ctx["workspace_id"],
        email=payload.email.strip().lower(),
        role=role,
        status="pending",
        invited_by=ctx["user_id"],
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return {
        "id": inv.id,
        "workspace_id": inv.workspace_id,
        "email": inv.email,
        "role": inv.role,
        "status": inv.status,
    }


@app.get("/api/workspaces/members")
async def list_workspace_members(
    ctx: dict = Depends(require_role({"OWNER", "ADMIN", "MANAGER"})),
    db: Session = Depends(get_db),
) -> dict:
    """List members of the active workspace."""
    rows = (
        db.query(WorkspaceMember, UserProfile)
        .outerjoin(UserProfile, UserProfile.supabase_user_id == WorkspaceMember.supabase_user_id)
        .filter(WorkspaceMember.workspace_id == ctx["workspace_id"])
        .all()
    )
    return {
        "members": [
            {
                "user_id": mem.supabase_user_id,
                "role": mem.role,
                "email": prof.email if prof else None,
                "full_name": prof.full_name if prof else None,
            }
            for mem, prof in rows
        ]
    }


@app.get("/api/admin/overview")
async def admin_overview(
    _admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Platform-wide overview metrics for SUPER_ADMIN."""
    return {
        "total_users": db.query(UserProfile).count(),
        "active_users": db.query(UserProfile).filter(UserProfile.is_active.is_(True)).count(),
        "total_workspaces": db.query(Workspace).count(),
        "total_leads": db.query(Lead).count(),
        "total_calls": db.query(Call).count(),
        "total_appointments": db.query(Appointment).count(),
    }


@app.get("/api/admin/users")
async def admin_list_users(
    search: str | None = Query(default=None, max_length=128),
    _admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    """List all registered users with workspace and role info."""
    query = db.query(UserProfile)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(UserProfile.email.ilike(term), UserProfile.full_name.ilike(term))
        )
    users = query.order_by(UserProfile.created_at.desc()).all()
    result = []
    for u in users:
        memberships = (
            db.query(WorkspaceMember, Workspace)
            .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
            .filter(WorkspaceMember.supabase_user_id == u.supabase_user_id)
            .all()
        )
        result.append(
            {
                "user_id": u.supabase_user_id,
                "email": u.email,
                "full_name": u.full_name,
                "account_type": u.account_type,
                "is_super_admin": u.is_super_admin,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "workspaces": [
                    {"id": ws.id, "name": ws.name, "role": mem.role}
                    for mem, ws in memberships
                ],
            }
        )
    return {"users": result}


@app.patch("/api/admin/users/{user_id}/status")
async def admin_toggle_user_status(
    user_id: str,
    is_active: bool = Query(...),
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Activate or deactivate a user account."""
    profile = db.query(UserProfile).filter(UserProfile.supabase_user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if profile.supabase_user_id == admin["user_id"] and not is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own SUPER_ADMIN account.")
    profile.is_active = is_active
    db.commit()
    record_admin_audit(
        db,
        admin,
        action="USER_STATUS_UPDATED",
        target_user_id=user_id,
        details=f"is_active={is_active}",
    )
    return {"user_id": user_id, "is_active": profile.is_active}


@app.get("/api/admin/workspaces")
async def admin_list_workspaces(
    _admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    """List all workspaces and usage counts."""
    workspaces = db.query(Workspace).order_by(Workspace.created_at.desc()).all()
    items = []
    for ws in workspaces:
        items.append(
            {
                "id": ws.id,
                "name": ws.name,
                "workspace_type": ws.workspace_type,
                "owner_user_id": ws.owner_user_id,
                "is_legacy": ws.is_legacy,
                "created_at": ws.created_at.isoformat() if ws.created_at else None,
                "member_count": db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count(),
                "lead_count": db.query(Lead).filter(Lead.workspace_id == ws.id).count(),
                "call_count": db.query(Call).filter(Call.workspace_id == ws.id).count(),
            }
        )
    return {"workspaces": items}


@app.get("/api/admin/users/{user_id}/inspect")
async def admin_inspect_user(
    user_id: str,
    admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Inspect a user's leads and calls with mandatory audit logging."""
    profile = db.query(UserProfile).filter(UserProfile.supabase_user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found.")

    ws_ids = [
        m.workspace_id
        for m in db.query(WorkspaceMember).filter(WorkspaceMember.supabase_user_id == user_id).all()
    ]
    leads = db.query(Lead).filter(Lead.workspace_id.in_(ws_ids)).all() if ws_ids else []
    calls = db.query(Call).filter(Call.workspace_id.in_(ws_ids)).all() if ws_ids else []

    record_admin_audit(
        db,
        admin,
        action="USER_DATA_INSPECTED",
        target_user_id=user_id,
        details=f"Inspected {len(leads)} leads and {len(calls)} calls",
    )

    return {
        "user": {
            "user_id": profile.supabase_user_id,
            "email": profile.email,
            "full_name": profile.full_name,
        },
        "leads": [_serialize_lead(l) for l in leads],
        "calls": [_serialize_call(c) for c in calls],
    }


@app.get("/api/admin/audit-logs")
async def admin_audit_logs(
    _admin: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    """List recent administrative audit logs."""
    logs = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(50).all()
    return {
        "logs": [
            {
                "id": log.id,
                "admin_email": log.admin_email,
                "action": log.action,
                "target_user_id": log.target_user_id,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }
