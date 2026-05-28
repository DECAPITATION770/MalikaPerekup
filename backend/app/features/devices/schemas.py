"""Request and response shapes for ``/devices/*`` endpoints.

Devices are read-mostly via this module: creation happens inside the
purchases endpoint, so we only need GET / search shapes here, plus a
small ``DeviceUpdate`` for fixing typos in characteristics.
"""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DeviceCategoryLiteral = Literal[
    "phone", "tablet", "laptop", "smartwatch", "accessory", "other"
]
DeviceConditionLiteral = Literal["new", "good", "normal", "broken"]
DeviceStatusLiteral = Literal[
    "in_stock", "reserved", "sold", "returned", "written_off"
]


class DeviceUpdate(BaseModel):
    """PATCH /devices/{id} — fix typos in description, swap photos, add notes."""

    brand: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=120)
    imei: str | None = Field(default=None, max_length=32)
    serial: str | None = Field(default=None, max_length=64)
    condition: DeviceConditionLiteral | None = None
    specs: dict[str, Any] | None = None
    photos: list[str] | None = None
    defects: list[str] | None = Field(default=None, max_length=32)
    notes: str | None = None


class SuggestOut(BaseModel):
    """GET /devices/suggestions — autocomplete values for the purchase form."""

    values: list[str]


class RecentModelOut(BaseModel):
    """One row in GET /devices/recent-models — a chip in the wizard's step 1."""

    brand: str
    model: str
    category: DeviceCategoryLiteral


class RecentModelsOut(BaseModel):
    items: list[RecentModelOut]


class PriceHintOut(BaseModel):
    """GET /devices/price-hint — past purchase prices for this brand+model.

    All amounts are in UZS (USD deals are pre-converted at the rate of
    that deal). ``count == 0`` means we've never bought this model before
    and the wizard should say "first time".
    """

    count: int
    last_price_uzs: str | None = None
    avg_price_uzs: str | None = None


class ImeiCheckOut(BaseModel):
    """GET /devices/imei-check — soft duplicate warning for the purchase form.

    ``found`` is the only field the frontend strictly needs; the rest let
    it say *"this exact unit came back from <seller> on <date>"*. Not a
    block — the real 409 is still enforced server-side on create when the
    duplicate is ``in_stock``.
    """

    found: bool
    status: DeviceStatusLiteral | None = None
    brand: str | None = None
    model: str | None = None
    purchase_date: date | None = None
    seller_name: str | None = None


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: DeviceCategoryLiteral
    brand: str
    model: str
    imei: str | None
    serial: str | None
    condition: DeviceConditionLiteral
    specs: dict[str, Any]
    photos: list[str]
    defects: list[str]
    status: DeviceStatusLiteral
    qr_token: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    # Defense-in-depth: collections that the ORM treats as nullable JSON
    # columns can come back as ``None`` if an old row pre-dates a migration
    # (e.g. ``devices.defects`` added in 0011). The frontend assumes arrays
    # — give it arrays even when the database hasn't been back-filled.
    @field_validator("photos", "defects", mode="before")
    @classmethod
    def _none_to_empty_list(cls, v: object) -> object:
        return [] if v is None else v

    @field_validator("specs", mode="before")
    @classmethod
    def _none_to_empty_dict(cls, v: object) -> object:
        return {} if v is None else v


class DeviceWithPurchaseOut(DeviceOut):
    """List-endpoint shape — adds purchase price + age for the Stock table.

    ``purchase_price_uzs`` is a string (Decimal as JSON; matches PurchaseOut).
    ``days_in_stock`` is computed from ``created_at`` on the server so the
    Mini App doesn't have to do timezone math.
    """

    purchase_price_uzs: str | None = None
    purchase_date: date | None = None
    days_in_stock: int | None = None
    photo_url: str | None = None
    """Signed GET URL for the first photo (≤15 min TTL) — list thumbnails."""
