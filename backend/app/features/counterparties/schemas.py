"""Request and response shapes for ``/counterparties/*`` endpoints."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.features.purchases.schemas import PurchaseOut
from app.features.sales.schemas import SaleOut

CounterpartyType = Literal["seller", "buyer", "both"]


class CounterpartyCreate(BaseModel):
    type: CounterpartyType = "seller"
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    doc_type: str | None = Field(default=None, max_length=32)
    doc_number: str | None = Field(default=None, max_length=64)
    doc_photos: list[str] = Field(default_factory=list)
    tg_username: str | None = Field(default=None, max_length=64)
    comment: str | None = None


class CounterpartyUpdate(BaseModel):
    """All fields optional — PATCH semantics."""

    type: CounterpartyType | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    doc_type: str | None = Field(default=None, max_length=32)
    doc_number: str | None = Field(default=None, max_length=64)
    doc_photos: list[str] | None = None
    tg_username: str | None = Field(default=None, max_length=64)
    comment: str | None = None


class CounterpartyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: CounterpartyType
    full_name: str
    phone: str | None
    doc_type: str | None
    doc_number: str | None
    doc_photos: list[str]
    tg_username: str | None
    comment: str | None
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime


class CounterpartyListItem(CounterpartyOut):
    """Directory-list row: same fields as ``CounterpartyOut`` + per-row aggregates
    so the screen can show "owes ₽X across N deals" at a glance without N+1
    requests. All aggregates are ``shop_id``-scoped (CLAUDE.md §6)."""

    deals_count: int = 0
    """Total deals = sales as buyer + purchases as seller, within this shop."""

    outstanding_nasiya_uzs: Decimal = Field(default_factory=lambda: Decimal(0))
    """Sum of ``plan.total_amount - paid_so_far`` across this counterparty's
    **active** installment plans (as buyer). Cash sales contribute 0."""

    last_deal_at: datetime | None = None
    """``GREATEST`` of the most recent sale (as buyer) and purchase (as seller).
    ``None`` when the counterparty has no deals yet."""


class CounterpartyDealsOut(BaseModel):
    """Counterparty card + full deal history (purchases from + sales to)."""

    counterparty: CounterpartyOut
    purchases: list[PurchaseOut]
    sales: list[SaleOut]


CounterpartyNoteKindLiteral = Literal[
    "call", "meeting", "message", "payment", "system", "other"
]


class CounterpartyNoteCreate(BaseModel):
    """User-typed interaction log entry. Body is required; ``kind`` defaults
    to ``other`` for the «just a comment» case."""

    body: str = Field(min_length=1, max_length=2000)
    kind: CounterpartyNoteKindLiteral = "other"


class CounterpartyNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    counterparty_id: int
    kind: CounterpartyNoteKindLiteral
    body: str
    created_at: datetime
    created_by: int


class CounterpartyPin(BaseModel):
    """Body for PATCH /counterparties/{id}/pin — single boolean field so
    the route is a clear toggle, not a generic patch shape."""

    is_pinned: bool


class CounterpartyStats(BaseModel):
    """Lifetime money + count rollups for one counterparty.

    Drives the «brought 12.5M · spent 4M · 2 active plans» strip at the top
    of CounterpartyDetail. UZS sums are Decimal-on-wire-as-string (CLAUDE.md §9).
    """

    purchases_total_uzs: Decimal = Field(default_factory=lambda: Decimal(0))
    """Sum of all ``purchases.price_uzs`` where this person was the seller."""
    purchases_count: int = 0

    sales_total_uzs: Decimal = Field(default_factory=lambda: Decimal(0))
    """Sum of all ``sales.price_uzs`` where this person was the buyer."""
    sales_count: int = 0

    active_nasiya_count: int = 0
    """Active installment plans the person currently owes money on."""

    last_contact_at: datetime | None = None
    """Newest of (last purchase, last sale, last note). Drives the
    «не общались N дней» banner — None means we never interacted."""
