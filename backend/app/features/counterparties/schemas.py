"""Request and response shapes for ``/counterparties/*`` endpoints."""

from datetime import datetime
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


class CounterpartyDealsOut(BaseModel):
    """Counterparty card + full deal history (purchases from + sales to)."""

    counterparty: CounterpartyOut
    purchases: list[PurchaseOut]
    sales: list[SaleOut]
