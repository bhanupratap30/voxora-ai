import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_BACKEND_ENV_PATH)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""


def _get_database_url() -> str:
    return os.getenv("DATABASE_URL", "").strip()


_engine = None
_SessionLocal = None


def get_engine():
    """Return or initialize the SQLAlchemy engine."""
    global _engine, _SessionLocal
    url = _get_database_url()
    if not url:
        return None
    if _engine is None:
        _engine = create_engine(url, pool_pre_ping=True)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_session_local():
    """Return sessionmaker if database is configured."""
    if _SessionLocal is None:
        get_engine()
    return _SessionLocal


def init_db() -> bool:
    """Create database tables safely on startup."""
    engine = get_engine()
    if engine is None:
        return False
    try:
        from app.models.lead import Lead  # noqa: F401
        from app.models.appointment import Appointment  # noqa: F401
        from app.models.call import Call  # noqa: F401
        from app.models.auth import (  # noqa: F401
            AdminAuditLog,
            UserProfile,
            Workspace,
            WorkspaceInvitation,
            WorkspaceMember,
        )

        Base.metadata.create_all(bind=engine)
        _ensure_lead_insight_columns(engine)
        return True
    except Exception:
        return False


def _ensure_lead_insight_columns(engine) -> None:
    """Safely add sentiment/intent columns to existing leads table without data loss."""
    alter_statements = [
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment VARCHAR(32) NOT NULL DEFAULT 'neutral'",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS emotion VARCHAR(32) NOT NULL DEFAULT 'unknown'",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent VARCHAR(64) NOT NULL DEFAULT 'general_inquiry'",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS buying_signal VARCHAR(32) NOT NULL DEFAULT 'low'",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency VARCHAR(32) NOT NULL DEFAULT 'low'",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS requires_human BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment_reason TEXT",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_callback_date VARCHAR(64)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_callback_time VARCHAR(64)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS human_followup_requested BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_status VARCHAR(32)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id INTEGER",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS workspace_id INTEGER",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS phone VARCHAR(64)",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'",
        "ALTER TABLE calls ADD COLUMN IF NOT EXISTS workspace_id INTEGER",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
    ]
    with engine.begin() as conn:
        for stmt in alter_statements:
            conn.execute(text(stmt))


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session."""
    session_factory = get_session_local()
    if session_factory is None:
        raise RuntimeError("DATABASE_URL is not configured in backend/.env.")
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
