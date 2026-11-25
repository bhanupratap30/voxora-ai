import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import Groq

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_BACKEND_ENV_PATH)

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

ALLOWED_SENTIMENTS = {"positive", "neutral", "negative"}
ALLOWED_EMOTIONS = {
    "interested",
    "satisfied",
    "curious",
    "frustrated",
    "hesitant",
    "confused",
    "disappointed",
    "urgent",
    "unknown",
}
ALLOWED_INTENTS = {
    "product_inquiry",
    "pricing_inquiry",
    "purchase_interest",
    "objection",
    "complaint",
    "support_request",
    "general_inquiry",
}
ALLOWED_LEVELS = {"low", "medium", "high"}

_DEFAULT_INSIGHTS: dict[str, Any] = {
    "sentiment": "neutral",
    "emotion": "unknown",
    "intent": "general_inquiry",
    "buying_signal": "low",
    "urgency": "low",
    "requires_human": False,
    "sentiment_reason": "Analysis unavailable; using default values.",
}

_SENTIMENT_SYSTEM_PROMPT = (
    "You are a customer sentiment and intent classifier for a sales voice agent. "
    "Analyze ONLY the latest customer message (using prior context only for disambiguation). "
    "Return a valid JSON object with these exact keys:\n"
    '- "sentiment": one of ["positive", "neutral", "negative"]\n'
    '- "emotion": one of ["interested", "satisfied", "curious", "frustrated", "hesitant", "confused", "disappointed", "urgent", "unknown"]\n'
    '- "intent": one of ["product_inquiry", "pricing_inquiry", "purchase_interest", "objection", "complaint", "support_request", "general_inquiry"]\n'
    '- "buying_signal": one of ["low", "medium", "high"]\n'
    '- "urgency": one of ["low", "medium", "high"]\n'
    '- "requires_human": boolean (true if the customer is frustrated, complaining, or asking for a human)\n'
    '- "reason": short 1-sentence explanation\n'
    "Respond with JSON only."
)


def _normalize_insights(raw: dict[str, Any]) -> dict[str, Any]:
    sentiment = str(raw.get("sentiment", "neutral")).strip().lower()
    emotion = str(raw.get("emotion", "unknown")).strip().lower()
    intent = str(raw.get("intent", "general_inquiry")).strip().lower()
    buying_signal = str(raw.get("buying_signal", "low")).strip().lower()
    urgency = str(raw.get("urgency", "low")).strip().lower()
    requires_human = bool(raw.get("requires_human", False))
    reason = str(raw.get("reason", "")).strip()[:300]

    return {
        "sentiment": sentiment if sentiment in ALLOWED_SENTIMENTS else "neutral",
        "emotion": emotion if emotion in ALLOWED_EMOTIONS else "unknown",
        "intent": intent if intent in ALLOWED_INTENTS else "general_inquiry",
        "buying_signal": buying_signal if buying_signal in ALLOWED_LEVELS else "low",
        "urgency": urgency if urgency in ALLOWED_LEVELS else "low",
        "requires_human": requires_human,
        "sentiment_reason": reason or "Classified from customer message.",
    }


def analyze_customer_sentiment(
    message: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Analyze the latest customer message for sentiment, emotion, intent, and buying signal."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return dict(_DEFAULT_INSIGHTS)

    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL
    context_lines = []
    if history:
        for item in history[-4:]:
            role = item.get("role", "user")
            content = item.get("content", "")
            if content:
                context_lines.append(f"{role}: {content}")

    user_prompt = (
        (f"Recent context:\n" + "\n".join(context_lines) + "\n\n")
        if context_lines
        else ""
    ) + f"Latest customer message: {message}"

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SENTIMENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw_text = completion.choices[0].message.content or "{}"
        parsed = json.loads(raw_text)
        if not isinstance(parsed, dict):
            return dict(_DEFAULT_INSIGHTS)
        return _normalize_insights(parsed)
    except Exception:
        return dict(_DEFAULT_INSIGHTS)
