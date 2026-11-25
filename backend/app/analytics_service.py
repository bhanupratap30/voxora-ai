from collections import Counter
from datetime import date, datetime, time, timezone
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.call import Call
from app.models.lead import Lead

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_BACKEND_ENV_PATH)

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


def _apply_date_range(query, model_cls, start_date: date | None, end_date: date | None):
    if start_date is not None:
        start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        query = query.filter(model_cls.created_at >= start_dt)
    if end_date is not None:
        end_dt = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
        query = query.filter(model_cls.created_at <= end_dt)
    return query


def _generate_ai_insights(summary_metrics: dict[str, Any]) -> str:
    """Generate concise business insights from aggregated metrics only."""
    if summary_metrics["total_calls"] == 0 and summary_metrics["total_leads"] == 0:
        return "No sales data recorded in this date range yet. Complete calls or capture leads to generate AI insights."

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return "AI insights unavailable (GROQ_API_KEY not configured)."

    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL
    prompt = (
        "You are a sales analytics advisor for Voxora AI. "
        "Based ONLY on the aggregated metrics below, provide 2-3 concise, actionable "
        "recommendations citing the exact numbers. Do not invent trends or data. "
        "No Markdown or emojis.\n\n"
        f"Metrics: {summary_metrics}"
    )
    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        return (completion.choices[0].message.content or "").strip() or "No insights generated."
    except Exception:
        return "AI insights temporarily unavailable."


def get_analytics(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    """Compute sales analytics from actual PostgreSQL records."""
    calls = _apply_date_range(db.query(Call), Call, start_date, end_date).all()
    leads = _apply_date_range(db.query(Lead), Lead, start_date, end_date).all()
    appointments = _apply_date_range(
        db.query(Appointment), Appointment, start_date, end_date
    ).all()

    # 1. Call Performance
    total_calls = len(calls)
    completed_calls = sum(1 for c in calls if c.status == "completed")
    failed_abandoned_calls = sum(1 for c in calls if c.status in {"failed", "abandoned"})
    durations = [c.duration_seconds for c in calls if c.status == "completed" and c.duration_seconds is not None]
    avg_duration_seconds = round(sum(durations) / len(durations)) if durations else 0

    call_dates: Counter[str] = Counter()
    for c in calls:
        if c.created_at:
            call_dates[c.created_at.date().isoformat()] += 1
    calls_over_time = [{"date": d, "calls": call_dates[d]} for d in sorted(call_dates)]

    # 2. Lead Performance
    total_leads = len(leads)
    cat_counts = Counter(l.lead_category or "Cold" for l in leads)
    qualified_leads = sum(
        1 for l in leads if l.qualification_complete or (l.lead_score or 0) >= 40
    )
    qualification_rate = (
        round((qualified_leads / total_leads) * 100, 1) if total_leads > 0 else 0.0
    )
    avg_lead_score = (
        round(sum((l.lead_score or 0) for l in leads) / total_leads, 1)
        if total_leads > 0
        else 0.0
    )

    # 3. Sentiment Analysis
    sentiment_counts = Counter(l.sentiment or "neutral" for l in leads)
    emotion_counts = Counter(l.emotion or "unknown" for l in leads)
    buying_signal_counts = Counter(l.buying_signal or "low" for l in leads)
    human_intervention_count = sum(1 for l in leads if l.requires_human)

    # 4. Appointment Performance
    total_appointments = len(appointments)
    appt_status_counts = Counter(a.status or "scheduled" for a in appointments)
    booking_rate = (
        round((total_appointments / total_calls) * 100, 1) if total_calls > 0 else 0.0
    )

    # 5. Sales Insights
    intent_counts = Counter(l.intent or "general_inquiry" for l in leads)
    objection_counts = Counter(
        c.objections.strip()
        for c in calls
        if c.objections and c.objections.strip().lower() not in {"none", "none raised.", "pending review.", "see transcript."}
    )

    summary_for_ai = {
        "total_calls": total_calls,
        "completed_calls": completed_calls,
        "total_leads": total_leads,
        "qualified_leads": qualified_leads,
        "qualification_rate_pct": qualification_rate,
        "total_appointments": total_appointments,
        "booking_rate_pct": booking_rate,
        "avg_lead_score": avg_lead_score,
        "high_buying_signal_leads": buying_signal_counts.get("high", 0),
        "human_intervention_count": human_intervention_count,
    }

    return {
        "call_performance": {
            "total_calls": total_calls,
            "completed_calls": completed_calls,
            "failed_abandoned_calls": failed_abandoned_calls,
            "avg_duration_seconds": avg_duration_seconds,
            "calls_over_time": calls_over_time,
        },
        "lead_performance": {
            "total_leads": total_leads,
            "qualified_leads": qualified_leads,
            "qualification_rate": qualification_rate,
            "avg_lead_score": avg_lead_score,
            "category_distribution": {
                "Hot": cat_counts.get("Hot", 0),
                "Warm": cat_counts.get("Warm", 0),
                "Cold": cat_counts.get("Cold", 0),
            },
        },
        "sentiment_analysis": {
            "sentiment_distribution": {
                "positive": sentiment_counts.get("positive", 0),
                "neutral": sentiment_counts.get("neutral", 0),
                "negative": sentiment_counts.get("negative", 0),
            },
            "emotion_distribution": dict(emotion_counts),
            "buying_signal_distribution": {
                "high": buying_signal_counts.get("high", 0),
                "medium": buying_signal_counts.get("medium", 0),
                "low": buying_signal_counts.get("low", 0),
            },
            "human_intervention_count": human_intervention_count,
        },
        "appointment_performance": {
            "total_appointments": total_appointments,
            "booking_rate": booking_rate,
            "status_distribution": {
                "scheduled": appt_status_counts.get("scheduled", 0),
                "completed": appt_status_counts.get("completed", 0),
                "cancelled": appt_status_counts.get("cancelled", 0),
            },
        },
        "sales_insights": {
            "conversion_funnel": [
                {"stage": "Calls", "count": total_calls},
                {"stage": "Qualified Leads", "count": qualified_leads},
                {"stage": "Appointments", "count": total_appointments},
            ],
            "top_intents": [
                {"intent": k, "count": v} for k, v in intent_counts.most_common(5)
            ],
            "top_objections": [
                {"objection": k, "count": v} for k, v in objection_counts.most_common(5)
            ],
            "high_buying_signal_leads": buying_signal_counts.get("high", 0),
        },
        "ai_insights": _generate_ai_insights(summary_for_ai),
    }
