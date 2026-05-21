"""Installment (Nasiya) models — payment plan and individual payments.

A ``Sale`` of type ``nasiya`` has exactly one ``InstallmentPlan``. The
plan owns a list of ``InstallmentPayment`` rows representing the agreed
schedule. Real-world payments mutate those rows: marking them paid,
partially paid, or paid-early.

Source of truth for "how much is left to pay":

    remaining = plan.total_amount - SUM(payment.amount_paid)

Reports query that on demand instead of caching it on the plan.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class PeriodType(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class PlanStatus(StrEnum):
    ACTIVE = "active"          # at least one pending or overdue payment
    COMPLETED = "completed"    # all payments paid (regularly or early)
    OVERDUE = "overdue"        # active AND has at least one overdue payment
    CANCELLED = "cancelled"    # sale was returned; plan stops, no further dues


class PaymentStatus(StrEnum):
    PENDING = "pending"        # due date in the future, nothing paid yet
    PARTIAL = "partial"        # paid > 0 but < amount_due
    PAID = "paid"              # paid >= amount_due
    OVERDUE = "overdue"        # due date passed, status not yet paid
    CLOSED_EARLY = "closed_early"  # zeroed out by an early payoff on a later row


class PaymentKind(StrEnum):
    """How the row was filled in.

    Distinguishes ordinary scheduled payments from a single "pay everything
    left" event so the device card can show "Закрыта досрочно".
    """

    REGULAR = "regular"
    PARTIAL = "partial"
    EARLY_PAYOFF = "early_payoff"


class InstallmentPlan(Base):
    __tablename__ = "installment_plans"

    id: Mapped[int] = mapped_column(primary_key=True)

    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )
    sale_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # ── Plan parameters captured at creation ──
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    """Sum that the buyer must pay back, in UZS (incl. ``down_payment``)."""

    down_payment: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, server_default="0"
    )
    """Amount taken right at the sale; counts toward ``total_amount``."""

    period_type: Mapped[str] = mapped_column(String(8), nullable=False)
    period_count: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(
        String(12), nullable=False, server_default=PlanStatus.ACTIVE.value
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        Index("ix_installment_plans_shop_status", "shop_id", "status"),
    )


class InstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id: Mapped[int] = mapped_column(primary_key=True)

    plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("installment_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Position in the schedule (1-based, includes the down-payment row at 0).
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_due: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, server_default="0"
    )

    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=PaymentStatus.PENDING.value
    )
    kind: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=PaymentKind.REGULAR.value
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        # Speeds up the morning bot job that fetches "today's overdue/due".
        Index("ix_installment_payments_due", "due_date", "status"),
    )
