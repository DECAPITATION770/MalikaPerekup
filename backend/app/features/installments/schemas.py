"""Request and response shapes for installment-related endpoints."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PeriodTypeLiteral = Literal["daily", "weekly", "monthly"]
PlanStatusLiteral = Literal["active", "completed", "overdue", "cancelled"]
PaymentStatusLiteral = Literal[
    "pending", "partial", "paid", "overdue", "closed_early"
]
PaymentKindLiteral = Literal["regular", "partial", "early_payoff"]


# ─── Inputs ────────────────────────────────────────────────────────────


class PlanCreate(BaseModel):
    """Build a payment schedule for an existing nasiya sale."""

    total_amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    """Full amount the buyer must repay (includes ``down_payment``)."""

    down_payment: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=18, decimal_places=2
    )
    period_type: PeriodTypeLiteral
    period_count: int = Field(ge=1, le=60)
    start_date: date


class PaymentRecord(BaseModel):
    """Record an actual payment received from the buyer.

    The router applies the amount to the earliest unpaid payment row(s),
    so the user only enters the amount and which plan it's for.
    """

    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    paid_at: datetime | None = None
    note: str | None = None


class EarlyPayoffRequest(BaseModel):
    """Buyer pays everything still owed in one go."""

    paid_at: datetime | None = None
    note: str | None = None


# ─── Outputs ───────────────────────────────────────────────────────────


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_id: int
    sequence: int
    due_date: date
    amount_due: Decimal
    amount_paid: Decimal
    status: PaymentStatusLiteral
    kind: PaymentKindLiteral
    paid_at: datetime | None
    note: str | None


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_id: int
    total_amount: Decimal
    down_payment: Decimal
    period_type: PeriodTypeLiteral
    period_count: int
    start_date: date
    status: PlanStatusLiteral
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    created_at: datetime

    # Debtor contact, joined from the linked sale + counterparty.
    # Optional so single-plan endpoints that ``model_validate`` a bare
    # ORM plan keep working (they don't need buyer contact).
    buyer_name: str | None = None
    buyer_phone: str | None = None
    buyer_tg_username: str | None = None

    # Device being paid off + the debtor's directory id — joined from the sale
    # so the plan card can show «iPhone 14» and link to the buyer's profile.
    device_id: int | None = None
    device_brand: str | None = None
    device_model: str | None = None
    counterparty_id: int | None = None

    # Aggregate payment progress, joined on the list endpoint so the Mini
    # App can render "осталось X из Y · K из N платежей" without an N+1.
    # Optional for the same reason as buyer_* — bare model_validate stays cheap.
    paid_amount: Decimal | None = None
    paid_count: int | None = None
    payments_count: int | None = None


class PlanWithPaymentsOut(PlanOut):
    payments: list[PaymentOut]
    remaining: Decimal
