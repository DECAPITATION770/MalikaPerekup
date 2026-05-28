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
