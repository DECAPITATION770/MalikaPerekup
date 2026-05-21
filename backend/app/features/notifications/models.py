"""Notification ORM model — durable outbox for outgoing reminders.

Why durable instead of "send right now":
* the process can crash between "decide to notify" and "actually send";
* the user might be temporarily unreachable (Telegram down, blocked bot);
* later channels (SMS, push) are external services with rate limits.

The dispatcher (in ``service.py``) polls the table every few seconds,
sends pending rows via the matching channel, and updates the row's status.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class NotificationChannel(StrEnum):
    """How the message reaches the user."""

    TELEGRAM = "telegram"
    SMS = "sms"        # Eskiz / Playmobile (stage 3)
    PUSH = "push"      # FCM / APNs (mobile, future)
    EMAIL = "email"


class NotificationKind(StrEnum):
    """What the notification is about — drives the rendered text."""

    DAILY_SUMMARY = "daily_summary"
    PAYMENT_DUE_TODAY = "payment_due_today"
    PAYMENT_OVERDUE = "payment_overdue"


class NotificationStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)

    # Render-time inputs: amounts, names, dates. Channel-specific text is
    # generated from ``kind + payload + user.language`` at send time so the
    # row stays small and UI tweaks don't require a DB rewrite.
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, server_default="{}"
    )

    # When this notification should leave the queue. NULL means "as soon
    # as possible" (the morning summary uses this).
    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(12), nullable=False, server_default=NotificationStatus.PENDING.value
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Idempotency key: ``shop_id:kind:date`` for daily summaries, or
    # ``payment_id:kind`` for payment events. Lets the scheduler safely
    # re-run without duplicate sends.
    dedup_key: Mapped[str | None] = mapped_column(String(120), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    __table_args__ = (
        # The dispatcher selects pending rows ordered by scheduled_for;
        # this index makes that scan cheap.
        Index("ix_notifications_status_scheduled", "status", "scheduled_for"),
        # Fast dedup lookups.
        Index("ix_notifications_dedup", "dedup_key"),
    )
