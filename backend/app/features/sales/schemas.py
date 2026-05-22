"""Request and response shapes for ``/sales/*`` endpoints."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.common.dates import today_tashkent
from app.features.purchases.schemas import CurrencyLiteral

SaleTypeLiteral = Literal["cash", "nasiya"]
SaleStatusLiteral = Literal["active", "returned", "cancelled"]


class BuyerOnSale(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    doc_type: str | None = Field(default=None, max_length=32)
    doc_number: str | None = Field(default=None, max_length=64)
    photos: list[str] = Field(default_factory=list)
    tg_username: str | None = Field(default=None, max_length=64)


class SaleCreate(BaseModel):
    """Sell a device that is currently ``in_stock``.

    For nasiya sales the actual instalment schedule is created in a
    follow-up call to ``/installments`` (stage 9). This endpoint only
    records the deal and flips the device status.
    """

    device_id: int

    buyer: BuyerOnSale

    sale_type: SaleTypeLiteral = "cash"
    currency: CurrencyLiteral
    price: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    exchange_rate: Decimal | None = Field(
        default=None, gt=0, max_digits=18, decimal_places=4
    )

    sale_date: date
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("sale_date")
    @classmethod
    def _no_future_date(cls, v: date) -> date:
        if v > today_tashkent():
            raise ValueError("sale_date cannot be in the future")
        return v

    @model_validator(mode="after")
    def _require_rate_for_usd(self) -> "SaleCreate":
        if self.currency == "USD" and self.exchange_rate is None:
            raise ValueError("exchange_rate is required for USD sales")
        return self


class SaleUpdate(BaseModel):
    """PATCH /sales/{id} — limited mutation, 24h window enforced by service."""

    buyer_name: str | None = Field(default=None, min_length=1, max_length=120)
    buyer_phone: str | None = Field(default=None, max_length=32)
    buyer_doc_type: str | None = Field(default=None, max_length=32)
    buyer_doc_number: str | None = Field(default=None, max_length=64)
    sale_date: date | None = None
    comment: str | None = None


class ReturnRequest(BaseModel):
    """Mark a sold device as returned by the buyer."""

    reason: str | None = None


class AddPhotosRequest(BaseModel):
    photos: list[str] = Field(min_length=1)


# ─── Outputs ───────────────────────────────────────────────────────────


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    counterparty_id: int | None

    buyer_name: str
    buyer_phone: str | None
    buyer_doc_type: str | None
    buyer_doc_number: str | None
    buyer_photos: list[str]

    sale_type: SaleTypeLiteral
    currency: CurrencyLiteral
    sale_price_uzs: Decimal
    sale_price_usd: Decimal | None
    exchange_rate: Decimal | None
    profit_uzs: Decimal
    purchase_price_uzs_snapshot: Decimal

    sale_date: date
    comment: str | None
    status: SaleStatusLiteral
    return_reason: str | None
    returned_at: datetime | None

    created_by: int
    created_at: datetime
    updated_at: datetime

    # Joined from the linked device on list endpoints so list rows can
    # show the human-readable device label without an N+1 fetch.
    device_brand: str | None = None
    device_model: str | None = None
    device_imei: str | None = None
    device_category: str | None = None
