from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Lead(Base):
    """Persistent CRM lead record."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workspace_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    monthly_call_volume: Mapped[str | None] = mapped_column(String(128), nullable=True)
    budget: Mapped[str | None] = mapped_column(String(128), nullable=True)
    purchase_timeline: Mapped[str | None] = mapped_column(String(128), nullable=True)
    decision_authority: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lead_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lead_category: Mapped[str] = mapped_column(String(32), default="Cold", nullable=False)
    qualification_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    qualification_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sentiment: Mapped[str] = mapped_column(String(32), default="neutral", nullable=False)
    emotion: Mapped[str] = mapped_column(String(32), default="unknown", nullable=False)
    intent: Mapped[str] = mapped_column(String(64), default="general_inquiry", nullable=False)
    buying_signal: Mapped[str] = mapped_column(String(32), default="low", nullable=False)
    urgency: Mapped[str] = mapped_column(String(32), default="low", nullable=False)
    requires_human: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sentiment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_callback_date: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preferred_callback_time: Mapped[str | None] = mapped_column(String(64), nullable=True)
    human_followup_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    followup_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
