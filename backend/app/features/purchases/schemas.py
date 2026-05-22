"""Request and response shapes for ``/purchases/*`` endpoints.

The create payload bundles two things — the device being acquired and the
purchase metadata (price, seller, photos). The service layer atomically
creates both rows and links them.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.common.dates import today_tashkent
from app.features.devices.schemas import (
    DeviceCategoryLiteral,
    DeviceConditionLiteral,
    DeviceOut,
)

CurrencyLiteral = Literal["UZS", "USD"]


# ─── Inputs ────────────────────────────────────────────────────────────


class DeviceOnPurchase(BaseModel):
    """Device characteristics — the part the user fills on the form."""

    category: DeviceCategoryLiteral
    brand: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=120)
    imei: str | None = Field(default=None, max_length=32)
    serial: str | None = Field(default=None, max_length=64)
    condition: DeviceConditionLiteral = "good"
    specs: dict[str, Any] = Field(default_factory=dict)
    photos: list[str] = Field(default_factory=list)
    defects: list[str] = Field(default_factory=list, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


class SellerOnPurchase(BaseModel):
    """Seller (counterparty) snapshot for this purchase.

    If ``phone`` matches an existing counterparty, the service auto-links it;
    otherwise a new directory entry is created.
    """

    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    doc_type: str | None = Field(default=None, max_length=32)
    doc_number: str | None = Field(default=None, max_length=64)
    photos: list[str] = Field(default_factory=list)
    tg_username: str | None = Field(default=None, max_length=64)


class PurchaseCreate(BaseModel):
    device: DeviceOnPurchase
    seller: SellerOnPurchase

    currency: CurrencyLiteral
    price: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    """Amount in ``currency``. UZS is integer-rounded; USD keeps cents."""

    exchange_rate: Decimal | None = Field(
        default=None, gt=0, max_digits=18, decimal_places=4
    )
    """Required for USD deals: how many UZS per 1 USD at the time of purchase."""

    purchase_date: date
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("purchase_date")
    @classmethod
    def _no_future_date(cls, v: date) -> date:
        if v > today_tashkent():
            raise ValueError("purchase_date cannot be in the future")
        return v

    @model_validator(mode="after")
    def _require_rate_for_usd(self) -> "PurchaseCreate":
        if self.currency == "USD" and self.exchange_rate is None:
            raise ValueError("exchange_rate is required for USD purchases")
        return self


class PurchaseUpdate(BaseModel):
    """PATCH /purchases/{id} — limited to mutable metadata.

    Device fields and price-after-24h editing are handled elsewhere.
    """

    seller_name: str | None = Field(default=None, min_length=1, max_length=120)
    seller_phone: str | None = Field(default=None, max_length=32)
    seller_doc_type: str | None = Field(default=None, max_length=32)
    seller_doc_number: str | None = Field(default=None, max_length=64)

    currency: CurrencyLiteral | None = None
    price: Decimal | None = Field(
        default=None, gt=0, max_digits=18, decimal_places=2
    )
    exchange_rate: Decimal | None = Field(
        default=None, gt=0, max_digits=18, decimal_places=4
    )
    purchase_date: date | None = None
    comment: str | None = None


class AddPhotosRequest(BaseModel):
    """Append seller-document photos that were just uploaded to S3."""

    photos: list[str] = Field(min_length=1)


class LastPurchaseDeviceTemplate(BaseModel):
    """Device part of the "repeat last" template (no IMEI/serial — unique
    per unit, must be re-entered)."""

    category: DeviceCategoryLiteral
    brand: str
    model: str
    condition: DeviceConditionLiteral
    specs: dict[str, Any]
    defects: list[str]


class LastPurchaseSellerTemplate(BaseModel):
    """Seller part of the "repeat last" template — enough to skip step 3."""

    counterparty_id: int | None = None
    full_name: str
    phone: str | None = None
    doc_type: str | None = None
    doc_number: str | None = None
    tg_username: str | None = None


class LastPurchaseTemplate(BaseModel):
    """GET /purchases/last — pre-fills the wizard so user only changes IMEI + price.

    Returned shape mirrors ``PurchaseCreate.device`` and ``.seller`` so the
    frontend can drop it straight into the form without re-mapping.
    """

    device: LastPurchaseDeviceTemplate
    seller: LastPurchaseSellerTemplate


# ─── Outputs ───────────────────────────────────────────────────────────


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int
    counterparty_id: int | None

    seller_name: str
    seller_phone: str | None
    seller_doc_type: str | None
    seller_doc_number: str | None
    seller_photos: list[str]

    currency: CurrencyLiteral
    price_uzs: Decimal
    price_usd: Decimal | None
    exchange_rate: Decimal | None
    purchase_date: date
    comment: str | None

    created_by: int
    created_at: datetime
    updated_at: datetime

    # Joined from the linked device on list endpoints so list rows can
    # show "Apple iPhone 14 Pro · IMEI ..." without an N+1 fetch.
    device_brand: str | None = None
    device_model: str | None = None
    device_imei: str | None = None
    device_category: str | None = None


class PurchaseWithDeviceOut(PurchaseOut):
    """Returned by ``POST /purchases`` so the caller gets the QR token at once."""

    device: DeviceOut
