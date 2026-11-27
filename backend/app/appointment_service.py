from datetime import date, datetime, time, timedelta
import os
from typing import Any

from sqlalchemy.orm import Session

from app.models.appointment import Appointment

DEFAULT_DEMO_DURATION_MINUTES = int(os.getenv("DEMO_DURATION_MINUTES", "30"))
BUSINESS_START_HOUR = int(os.getenv("BUSINESS_START_HOUR", "9"))
BUSINESS_END_HOUR = int(os.getenv("BUSINESS_END_HOUR", "18"))
DEFAULT_TIMEZONE = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")
ALLOWED_STATUSES = {"scheduled", "cancelled", "completed"}
ALLOWED_MEETING_TYPES = {"online", "phone"}


class AppointmentConflictError(ValueError):
    """Raised when a requested appointment slot overlaps an existing one."""


class AppointmentValidationError(ValueError):
    """Raised when appointment date, time, or fields are invalid."""


def _compute_end_time(
    appointment_date: date,
    start_time: time,
    end_time: time | None = None,
    duration_minutes: int = DEFAULT_DEMO_DURATION_MINUTES,
) -> time:
    start_dt = datetime.combine(appointment_date, start_time)
    if end_time is None:
        end_dt = start_dt + timedelta(minutes=duration_minutes)
        if end_dt.date() != appointment_date:
            raise AppointmentValidationError("Appointment cannot cross midnight.")
        return end_dt.time()

    if end_time <= start_time:
        raise AppointmentValidationError("end_time must be after start_time.")
    return end_time


def _validate_not_in_past(appointment_date: date, start_time: time) -> None:
    now = datetime.now()
    if datetime.combine(appointment_date, start_time) <= now:
        raise AppointmentValidationError("Appointment date and time must be in the future.")


def _validate_business_hours(start_time: time, end_time: time) -> None:
    b_start = time(BUSINESS_START_HOUR, 0)
    b_end = time(BUSINESS_END_HOUR, 0)
    if start_time < b_start or end_time > b_end:
        raise AppointmentValidationError(
            f"Appointments must be within business hours ({BUSINESS_START_HOUR:02d}:00–{BUSINESS_END_HOUR:02d}:00)."
        )


def check_slot_availability(
    db: Session,
    appointment_date: date,
    start_time: time,
    end_time: time | None = None,
) -> dict[str, Any]:
    """Check if a slot is available and suggest alternatives if not."""
    resolved_end = _compute_end_time(appointment_date, start_time, end_time)
    _validate_not_in_past(appointment_date, start_time)
    _validate_business_hours(start_time, resolved_end)

    overlapping = (
        db.query(Appointment)
        .filter(
            Appointment.appointment_date == appointment_date,
            Appointment.status == "scheduled",
            Appointment.start_time < resolved_end,
            Appointment.end_time > start_time,
        )
        .first()
    )

    if overlapping is None:
        return {
            "available": True,
            "appointment_date": appointment_date.isoformat(),
            "start_time": start_time.strftime("%H:%M"),
            "end_time": resolved_end.strftime("%H:%M"),
            "alternatives": [],
        }

    alternatives: list[str] = []
    candidate_dt = datetime.combine(appointment_date, time(9, 0))
    end_of_day = datetime.combine(appointment_date, time(18, 0))
    now = datetime.now()

    while candidate_dt < end_of_day and len(alternatives) < 3:
        c_start = candidate_dt.time()
        c_end = (candidate_dt + timedelta(minutes=DEFAULT_DEMO_DURATION_MINUTES)).time()
        if candidate_dt > now:
            conflict = (
                db.query(Appointment)
                .filter(
                    Appointment.appointment_date == appointment_date,
                    Appointment.status == "scheduled",
                    Appointment.start_time < c_end,
                    Appointment.end_time > c_start,
                )
                .first()
            )
            if conflict is None:
                alternatives.append(c_start.strftime("%H:%M"))
        candidate_dt += timedelta(minutes=DEFAULT_DEMO_DURATION_MINUTES)

    return {
        "available": False,
        "appointment_date": appointment_date.isoformat(),
        "start_time": start_time.strftime("%H:%M"),
        "end_time": resolved_end.strftime("%H:%M"),
        "alternatives": alternatives,
    }


def create_appointment(
    db: Session,
    customer_name: str,
    appointment_date: date,
    start_time: time,
    end_time: time | None = None,
    company_name: str | None = None,
    customer_email: str | None = None,
    phone: str | None = None,
    timezone: str = DEFAULT_TIMEZONE,
    lead_id: int | None = None,
    workspace_id: int | None = None,
    meeting_type: str = "online",
    notes: str | None = None,
) -> Appointment:
    """Create a scheduled appointment safely inside a database transaction."""
    clean_name = customer_name.strip()
    if not clean_name:
        raise AppointmentValidationError("customer_name is required.")

    clean_type = meeting_type.strip().lower()
    if clean_type not in ALLOWED_MEETING_TYPES:
        raise AppointmentValidationError("meeting_type must be 'online' or 'phone'.")

    resolved_end = _compute_end_time(appointment_date, start_time, end_time)
    _validate_not_in_past(appointment_date, start_time)
    _validate_business_hours(start_time, resolved_end)
    _validate_business_hours(start_time, resolved_end)

    # Lock existing scheduled rows for this date to prevent concurrent double-booking
    existing_for_date = (
        db.query(Appointment)
        .filter(
            Appointment.appointment_date == appointment_date,
            Appointment.status == "scheduled",
            Appointment.start_time < resolved_end,
            Appointment.end_time > start_time,
        )
        .with_for_update()
        .first()
    )

    if existing_for_date is not None:
        raise AppointmentConflictError(
            "This time slot overlaps with an existing scheduled appointment."
        )

    appointment = Appointment(
        workspace_id=workspace_id,
        lead_id=lead_id,
        customer_name=clean_name,
        customer_email=customer_email.strip().lower() if customer_email else None,
        phone=phone.strip() if phone else None,
        company_name=company_name.strip() if company_name else None,
        appointment_date=appointment_date,
        start_time=start_time,
        end_time=resolved_end,
        timezone=(timezone or DEFAULT_TIMEZONE).strip(),
        status="scheduled",
        meeting_type=clean_type,
        notes=notes.strip() if notes else None,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def list_appointments(
    db: Session,
    workspace_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Appointment], int]:
    """List appointments ordered by date and start time."""
    query = db.query(Appointment)
    if workspace_id is not None:
        query = query.filter(Appointment.workspace_id == workspace_id)
    if status and status in ALLOWED_STATUSES:
        query = query.filter(Appointment.status == status)
    total = query.count()
    items = (
        query.order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def get_appointment(db: Session, appointment_id: int) -> Appointment | None:
    """Retrieve a single appointment by ID."""
    return db.query(Appointment).filter(Appointment.id == appointment_id).first()


def update_appointment(
    db: Session,
    appointment_id: int,
    status: str | None = None,
    notes: str | None = None,
) -> Appointment:
    """Update an appointment's status or notes."""
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise FileNotFoundError("Appointment not found.")

    if status is not None:
        clean_status = status.strip().lower()
        if clean_status not in ALLOWED_STATUSES:
            raise AppointmentValidationError(
                "status must be 'scheduled', 'cancelled', or 'completed'."
            )
        appointment.status = clean_status

    if notes is not None:
        appointment.notes = notes.strip()

    db.commit()
    db.refresh(appointment)
    return appointment


def cancel_appointment(db: Session, appointment_id: int) -> Appointment:
    """Cancel an appointment by setting its status to 'cancelled'."""
    return update_appointment(db, appointment_id, status="cancelled")
