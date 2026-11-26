import re
from typing import Any

ALL_LEAD_FIELDS = [
    "customer_name",
    "company_name",
    "business_type",
    "requirements",
    "monthly_call_volume",
    "budget",
    "purchase_timeline",
    "decision_authority",
    "email",
    "preferred_callback_date",
    "preferred_callback_time",
]

_SESSIONS: dict[str, dict[str, Any]] = {}


def get_or_create_session(session_id: str) -> dict[str, Any]:
    """Return existing session state or hydrate from PostgreSQL if available."""
    sid = (session_id or "default").strip() or "default"
    if sid not in _SESSIONS:
        fields: dict[str, str] = {}
        try:
            from app.database import get_session_local
            from app.models.lead import Lead

            session_factory = get_session_local()
            if session_factory is not None:
                db = session_factory()
                try:
                    lead = db.query(Lead).filter(Lead.session_id == sid).first()
                    if lead is not None:
                        for f in ALL_LEAD_FIELDS:
                            val = getattr(lead, f, None)
                            if val:
                                fields[f] = str(val)
                        if lead.human_followup_requested:
                            fields["human_followup_requested"] = "true"
                            fields["followup_status"] = lead.followup_status or "recorded"
                finally:
                    db.close()
        except Exception:
            pass

        _SESSIONS[sid] = {
            "fields": fields,
            "history": [],
            "booking": {"booking_status": "not_requested"},
        }
    return _SESSIONS[sid]


def clear_session(session_id: str) -> None:
    """Reset a conversation session."""
    sid = (session_id or "default").strip() or "default"
    _SESSIONS.pop(sid, None)


def extract_lead_fields(message: str, existing: dict[str, str]) -> dict[str, str]:
    """Deterministically extract verified lead fields from a customer message."""
    updated = dict(existing)
    text = message.strip()
    lower = text.lower()

    if "customer_name" not in updated:
        name_match = re.search(
            r"(?:my name is|i am|i'm|this is|मेरा नाम)\s+([A-Za-z\u0900-\u097F]+(?:\s+(?!from\b|at\b|and\b|with\b|है)[A-Za-z\u0900-\u097F]+){0,2})",
            text,
            re.IGNORECASE,
        )
        if name_match:
            candidate = name_match.group(1).strip()
            if candidate.lower() not in {"looking", "interested", "from", "calling", "a", "the"}:
                updated["customer_name"] = candidate

    # Dynamic company/organisation extraction (English & Hindi, no restricted lists)
    en_comp = re.search(
        r"(?:my company(?:\s+name)?\s+is|company(?:\s+name)?\s+is|work(?:ing)?\s+at|i\s+am\s+representing|represent(?:ing)?(?:\s+a\s+[\w\s\-]+?\s+called)?|we\s+are\s+from|i\s+am\s+from|from)\s+([A-Za-z0-9&\-']+(?:\s+[A-Za-z0-9&\-']+){0,4})",
        text,
        re.IGNORECASE,
    )
    hi_comp = re.search(
        r"(?:मेरी कंपनी का नाम|कंपनी का नाम)\s+([^\s,।.?!]+(?:\s+(?!है|हैं)[^\s,।.?!]+){0,3})|(?:मैं|हम)\s+([^\n,।.?!]+?)\s+(?:कंपनी से|की तरफ से|की ओर से|को\s+represent)",
        text,
    )
    extracted_company = None
    if hi_comp:
        extracted_company = (hi_comp.group(1) or hi_comp.group(2) or "").strip(" .,।?!")
    elif en_comp:
        candidate = en_comp.group(1).strip(" .,?!")
        # Trim trailing clause connectors
        candidate = re.sub(r"\s+(?:and|we|our|which|that|for|in|focused)\b.*$", "", candidate, flags=re.IGNORECASE).strip()
        if candidate and candidate.lower() not in {"a", "an", "the", "india", "delhi", "mumbai"}:
            extracted_company = candidate

    if extracted_company:
        updated["company_name"] = extracted_company

    if "both b2b and consumer" in lower or ("b2b" in lower and "consumer" in lower):
        updated["business_type"] = "Both B2B and consumer"
    else:
        business_keywords = [
            "enterprise", "midsize", "mid-size", "smb", "startup", "small business",
            "e-commerce", "ecommerce", "saas", "healthcare", "real estate",
            "fintech", "retail", "agency", "b2b", "consumer", "education", "insurance",
            "hospitality", "software", "consulting", "logistics",
        ]
        for kw in business_keywords:
            if re.search(rf"\b{re.escape(kw)}\b", lower):
                updated["business_type"] = kw.capitalize() if kw in {"enterprise", "midsize", "mid-size", "smb", "startup"} else kw
                break

    email_match = re.search(r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b", text)
    if email_match:
        updated["email"] = email_match.group(1).strip().lower()

    cb_date_match = re.search(r"\b(\d{4}-\d{2}-\d{2}|tomorrow|today)\b", lower)
    if cb_date_match and any(kw in lower for kw in ["callback", "call back", "call me", "reach me", "follow up"]):
        updated["preferred_callback_date"] = cb_date_match.group(1)

    cb_time_match = re.search(r"\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b", lower)
    if cb_time_match and any(kw in lower for kw in ["callback", "call back", "call me", "reach me", "at ", "follow up", "time"]):
        updated["preferred_callback_time"] = cb_time_match.group(1).upper()

    if "monthly_call_volume" not in updated:
        vol_match = re.search(
            r"(\d[\d,]*\s*(?:k|K)?\s*(?:calls?|minutes?|users?|interactions?)(?:\s*(?:per\s*month|a\s*month|/month|monthly))?|(?:one|1)\s+lakh\s+(?:monthly\s+)?(?:users?|calls?|interactions?))",
            text,
            re.IGNORECASE,
        )
        if vol_match:
            updated["monthly_call_volume"] = vol_match.group(1).strip()

    if "budget" not in updated:
        budget_match = re.search(
            r"(?:budget(?:\s+is|\s+of)?\s*)?([\$₹]\s*\d[\d,]*(?:\s*[kKmM])?|\d[\d,]*(?:\s*[kK])?\s*(?:usd|inr|rs|dollars?|rupees?)(?:\s*/\s*month|\s*per\s*month)?)",
            text,
            re.IGNORECASE,
        )
        if budget_match:
            updated["budget"] = budget_match.group(1).strip()
        elif "no budget" in lower:
            updated["budget"] = "no budget"

    if "purchase_timeline" not in updated:
        timeline_patterns = [
            r"(immediately|asap|right away|this week|this month|next week|next month|next quarter|this quarter|in \d+\s*(?:days?|weeks?|months?)|just exploring|6\+? months|तुरंत|इस महीने|अगले महीने)",
        ]
        for pat in timeline_patterns:
            m = re.search(pat, lower, re.IGNORECASE)
            if m:
                updated["purchase_timeline"] = m.group(1).strip()
                break

    if "decision_authority" not in updated:
        if any(
            kw in lower
            for kw in [
                "i am the ceo", "i'm the ceo", "founder", "co-founder",
                "owner", "director", "vp", "decision maker", "i decide",
                "i make the decision", "final decision",
            ]
        ):
            updated["decision_authority"] = "decision maker"
        elif any(kw in lower for kw in ["manager", "head of", "team lead"]):
            updated["decision_authority"] = "influencer / manager"
        elif any(kw in lower for kw in ["need approval", "ask my boss", "evaluating for"]):
            updated["decision_authority"] = "needs approval"

    if "requirements" not in updated:
        if any(
            kw in lower
            for kw in [
                "need", "looking for", "want to", "automate", "pain point",
                "problem", "problems", "challenge", "voice agent", "outbound",
                "inbound", "lead qualification", "support", "connects with customers",
                "resolve", "ai product", "चाहिए",
            ]
        ):
            updated["requirements"] = text[:200]

    if any(
        kw in lower
        for kw in [
            "human", "specialist", "representative", "talk to someone",
            "speak to a person", "real person", "इंसान", "प्रतिनिधि",
        ]
    ):
        updated["human_followup_requested"] = "true"
        updated["followup_status"] = "recorded"

    return updated


def calculate_lead_score(fields: dict[str, str]) -> dict[str, Any]:
    """Deterministically score a lead (0-100) from verified fields only."""
    req_score = 0
    if "requirements" in fields:
        req_score = 15
        if "monthly_call_volume" in fields or "business_type" in fields:
            req_score = 25

    budget_score = 0
    if "budget" in fields:
        b_lower = fields["budget"].lower()
        if "no budget" in b_lower:
            budget_score = 5
        else:
            num_match = re.search(r"(\d[\d,]*)", b_lower)
            if num_match:
                val = int(num_match.group(1).replace(",", ""))
                if "k" in b_lower:
                    val *= 1000
                budget_score = 25 if val >= 500 else 15
            else:
                budget_score = 15

    timeline_score = 0
    if "purchase_timeline" in fields:
        t_lower = fields["purchase_timeline"].lower()
        if any(kw in t_lower for kw in ["immediately", "asap", "right away", "this week", "this month", "तुरंत", "इस महीने"]):
            timeline_score = 25
        elif any(kw in t_lower for kw in ["next week", "next month", "quarter", "अगले महीने", "weeks"]):
            timeline_score = 15
        else:
            timeline_score = 5

    authority_score = 0
    if "decision_authority" in fields:
        a_lower = fields["decision_authority"].lower()
        if "decision maker" in a_lower:
            authority_score = 25
        elif "manager" in a_lower:
            authority_score = 15
        else:
            authority_score = 5

    total_score = req_score + budget_score + timeline_score + authority_score
    if total_score >= 70:
        category = "Hot"
    elif total_score >= 40:
        category = "Warm"
    else:
        category = "Cold"

    collected = {k: fields[k] for k in ALL_LEAD_FIELDS if k in fields}
    missing = [k for k in ALL_LEAD_FIELDS if k not in fields]
    progress = round((len(collected) / len(ALL_LEAD_FIELDS)) * 100)

    return {
        "qualification_progress": progress,
        "collected_fields": collected,
        "missing_fields": missing,
        "lead_score": total_score,
        "lead_category": category,
        "qualification_complete": len(missing) == 0,
    }


def persist_lead_to_db(
    session_id: str,
    qualification: dict[str, Any],
    sentiment_data: dict[str, Any] | None = None,
    workspace_id: int | None = None,
) -> None:
    """Persist or update a lead record in PostgreSQL without breaking chat on failure."""
    try:
        from app.database import get_session_local
        from app.models.lead import Lead

        session_factory = get_session_local()
        if session_factory is None:
            return

        db = session_factory()
        try:
            sid = (session_id or "default").strip() or "default"
            lead = db.query(Lead).filter(Lead.session_id == sid).first()
            collected = qualification.get("collected_fields") or {}

            if lead is None:
                lead = Lead(session_id=sid, workspace_id=workspace_id)
                db.add(lead)
            elif workspace_id is not None and lead.workspace_id is None:
                lead.workspace_id = workspace_id

            for field in ALL_LEAD_FIELDS:
                if field in collected:
                    setattr(lead, field, collected[field])

            if collected.get("human_followup_requested") == "true" or lead.human_followup_requested:
                lead.human_followup_requested = True
                lead.followup_status = collected.get("followup_status") or lead.followup_status or "recorded"

            lead.lead_score = qualification.get("lead_score", 0)
            lead.lead_category = qualification.get("lead_category", "Cold")
            lead.qualification_progress = qualification.get("qualification_progress", 0)
            lead.qualification_complete = qualification.get("qualification_complete", False)

            if sentiment_data:
                lead.sentiment = sentiment_data.get("sentiment", "neutral")
                lead.emotion = sentiment_data.get("emotion", "unknown")
                lead.intent = sentiment_data.get("intent", "general_inquiry")
                lead.buying_signal = sentiment_data.get("buying_signal", "low")
                lead.urgency = sentiment_data.get("urgency", "low")
                lead.requires_human = bool(sentiment_data.get("requires_human", False))
                lead.sentiment_reason = sentiment_data.get("sentiment_reason")

            db.commit()
        finally:
            db.close()
    except Exception:
        pass


def update_session_lead(
    session_id: str,
    message: str,
    sentiment_data: dict[str, Any] | None = None,
    workspace_id: int | None = None,
) -> dict[str, Any]:
    """Extract fields from message, update session, persist to DB, and return qualification metadata."""
    session = get_or_create_session(session_id)
    session["fields"] = extract_lead_fields(message, session["fields"])
    qualification = calculate_lead_score(session["fields"])
    persist_lead_to_db(
        session_id,
        qualification,
        sentiment_data=sentiment_data,
        workspace_id=workspace_id,
    )
    return qualification
