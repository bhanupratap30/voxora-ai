import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.appointment import Appointment
from app.models.auth import UserProfile, Workspace, WorkspaceInvitation, WorkspaceMember
from app.models.call import Call
from app.models.lead import Lead

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_BACKEND_ENV_PATH)

VALID_ROLES = {"OWNER", "ADMIN", "MANAGER", "SALES_AGENT"}
_bearer_scheme = HTTPBearer(auto_error=False)
_jwks_client: PyJWKClient | None = None


def _get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    supabase_url = _get_supabase_url()
    if not supabase_url:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_URL is not configured in backend/.env.",
        )
    if _jwks_client is None:
        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def verify_supabase_token(token: str) -> dict[str, Any]:
    """Verify a Supabase JWT using the project's JWKS endpoint."""
    supabase_url = _get_supabase_url()
    client = _get_jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            issuer=f"{supabase_url}/auth/v1",
        )
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Authentication token expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token.") from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict[str, Any]:
    """FastAPI dependency returning verified Supabase user claims."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authentication required.")
    payload = verify_supabase_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject.")
    return {
        "user_id": user_id,
        "email": (payload.get("email") or "").strip().lower(),
        "user_metadata": payload.get("user_metadata") or {},
    }


def _claim_legacy_records_if_owner(db: Session, user_id: str, email: str) -> None:
    """Assign unowned legacy records to a legacy workspace for VOXORA_LEGACY_OWNER_EMAIL only."""
    legacy_email = os.getenv("VOXORA_LEGACY_OWNER_EMAIL", "").strip().lower()
    if not legacy_email or not email or email != legacy_email:
        return

    existing_legacy = db.query(Workspace).filter(Workspace.is_legacy.is_(True)).first()
    if existing_legacy is None:
        existing_legacy = Workspace(
            name="Voxora Legacy Workspace",
            workspace_type="personal",
            owner_user_id=user_id,
            is_legacy=True,
        )
        db.add(existing_legacy)
        db.flush()
        db.add(
            WorkspaceMember(
                workspace_id=existing_legacy.id,
                supabase_user_id=user_id,
                role="OWNER",
            )
        )

    db.query(Lead).filter(Lead.workspace_id.is_(None)).update(
        {"workspace_id": existing_legacy.id}, synchronize_session=False
    )
    db.query(Appointment).filter(Appointment.workspace_id.is_(None)).update(
        {"workspace_id": existing_legacy.id}, synchronize_session=False
    )
    db.query(Call).filter(Call.workspace_id.is_(None)).update(
        {"workspace_id": existing_legacy.id}, synchronize_session=False
    )


def ensure_user_onboarded(
    db: Session,
    user: dict[str, Any],
    full_name: str | None = None,
    account_type: str = "individual",
    company_name: str | None = None,
) -> dict[str, Any]:
    """Idempotently create user profile, personal/company workspace, and OWNER role."""
    user_id = user["user_id"]
    email = user["email"]
    meta = user.get("user_metadata") or {}
    resolved_name = (full_name or meta.get("full_name") or meta.get("name") or "").strip() or None
    resolved_avatar = meta.get("avatar_url") or meta.get("picture")

    profile = db.query(UserProfile).filter(UserProfile.supabase_user_id == user_id).first()
    if profile is None:
        profile = UserProfile(
            supabase_user_id=user_id,
            email=email,
            full_name=resolved_name,
            avatar_url=resolved_avatar,
            account_type=account_type if account_type in {"individual", "company"} else "individual",
        )
        db.add(profile)
        db.flush()

    # Accept any pending invitations for this email
    if email:
        pending = (
            db.query(WorkspaceInvitation)
            .filter(WorkspaceInvitation.email == email, WorkspaceInvitation.status == "pending")
            .all()
        )
        for inv in pending:
            exists = (
                db.query(WorkspaceMember)
                .filter(
                    WorkspaceMember.workspace_id == inv.workspace_id,
                    WorkspaceMember.supabase_user_id == user_id,
                )
                .first()
            )
            if exists is None:
                db.add(
                    WorkspaceMember(
                        workspace_id=inv.workspace_id,
                        supabase_user_id=user_id,
                        role=inv.role,
                    )
                )
            inv.status = "accepted"

    # Ensure user has at least one workspace
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.supabase_user_id == user_id)
        .all()
    )
    if not memberships:
        ws_type = "company" if account_type == "company" else "personal"
        ws_name = (
            (company_name or "").strip()
            if ws_type == "company" and (company_name or "").strip()
            else f"{resolved_name or email or 'Personal'}'s Workspace"
        )
        ws = Workspace(
            name=ws_name,
            workspace_type=ws_type,
            owner_user_id=user_id,
            is_legacy=False,
        )
        db.add(ws)
        db.flush()
        db.add(
            WorkspaceMember(
                workspace_id=ws.id,
                supabase_user_id=user_id,
                role="OWNER",
            )
        )

    _claim_legacy_records_if_owner(db, user_id, email)
    db.commit()

    # Return profile + workspaces
    rows = (
        db.query(WorkspaceMember, Workspace)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .filter(WorkspaceMember.supabase_user_id == user_id)
        .all()
    )
    workspaces = [
        {
            "id": ws.id,
            "name": ws.name,
            "workspace_type": ws.workspace_type,
            "role": mem.role,
            "is_legacy": ws.is_legacy,
        }
        for mem, ws in rows
    ]
    return {
        "user_id": user_id,
        "email": profile.email,
        "full_name": profile.full_name,
        "avatar_url": profile.avatar_url,
        "account_type": profile.account_type,
        "workspaces": workspaces,
    }


def get_current_workspace(
    x_workspace_id: int | None = Header(default=None, alias="X-Workspace-Id"),
    user: dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Verify workspace membership and return active workspace + role."""
    user_id = user["user_id"]
    query = db.query(WorkspaceMember).filter(WorkspaceMember.supabase_user_id == user_id)
    if x_workspace_id is not None:
        member = query.filter(WorkspaceMember.workspace_id == x_workspace_id).first()
        if member is None:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this workspace.",
            )
    else:
        member = query.order_by(WorkspaceMember.id.asc()).first()
        if member is None:
            onboarded = ensure_user_onboarded(db, user)
            first_ws = onboarded["workspaces"][0]
            return {
                "workspace_id": first_ws["id"],
                "role": first_ws["role"],
                "user_id": user_id,
                "email": user["email"],
            }

    return {
        "workspace_id": member.workspace_id,
        "role": member.role,
        "user_id": user_id,
        "email": user["email"],
    }


def require_role(allowed_roles: set[str]):
    """Dependency factory enforcing RBAC roles on endpoints."""

    def _checker(ctx: dict[str, Any] = Depends(get_current_workspace)) -> dict[str, Any]:
        if ctx["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{ctx['role']}' is not authorized for this action.",
            )
        return ctx

    return _checker
