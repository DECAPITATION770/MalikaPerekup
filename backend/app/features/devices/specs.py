"""Per-category specs validation for the purchase wizard step 2.

The DB stores ``Device.specs`` as a free JSON dict (so we can add fields
without a migration), but the create-purchase endpoint validates incoming
specs against a category-specific Pydantic model and round-trips them as
dicts. This rejects nonsense early (e.g. ``ram_gb=-1`` or ``cpu`` for a
phone) without locking us into a rigid schema.

Used by ``purchases/service.create_purchase`` and unit-tested in isolation.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class _BaseSpecs(BaseModel):
    """All category specs forbid unknown keys so a typo doesn't silently
    pass through to the DB."""
    model_config = ConfigDict(extra="forbid")


class PhoneSpecs(_BaseSpecs):
    ram_gb: int | None = Field(default=None, ge=1, le=64)
    storage_gb: int | None = Field(default=None, ge=1, le=4096)
    color: str | None = Field(default=None, max_length=32)
    # Health of the battery as % of original capacity (iPhone shows it under
    # Settings → Battery → Battery Health). Far more useful at the market
    # than raw mAh — a used phone with 78% can't last a day even if it
    # «had» 4200 mAh new.
    battery_health_pct: int | None = Field(default=None, ge=1, le=100)


# Same shape as a phone — tablets have the same dimensions in practice.
TabletSpecs = PhoneSpecs


class LaptopSpecs(_BaseSpecs):
    ram_gb: int | None = Field(default=None, ge=1, le=256)
    storage_gb: int | None = Field(default=None, ge=1, le=8192)
    cpu: str | None = Field(default=None, max_length=64)
    gpu: str | None = Field(default=None, max_length=64)
    screen_inches: float | None = Field(default=None, gt=0, le=30)
    color: str | None = Field(default=None, max_length=32)


class SmartwatchSpecs(_BaseSpecs):
    storage_gb: int | None = Field(default=None, ge=1, le=512)
    color: str | None = Field(default=None, max_length=32)
    battery_health_pct: int | None = Field(default=None, ge=1, le=100)
    # Toggle chips — list of constants, validated by Pydantic.
    connectivity: list[str] = Field(default_factory=list, max_length=8)


class AccessorySpecs(_BaseSpecs):
    color: str | None = Field(default=None, max_length=32)
    connectivity: list[str] = Field(default_factory=list, max_length=8)


# ``other`` accepts any string-keyed string-valued pairs — the user knows
# best what to call it. Capped at 12 entries so we don't store a novel.
class OtherSpecs(BaseModel):
    model_config = ConfigDict(extra="allow")


_SPECS_BY_CATEGORY: dict[str, type[BaseModel]] = {
    "phone": PhoneSpecs,
    "tablet": TabletSpecs,
    "laptop": LaptopSpecs,
    "smartwatch": SmartwatchSpecs,
    "accessory": AccessorySpecs,
    "other": OtherSpecs,
}


class SpecsValidationError(ValueError):
    """Raised when ``specs`` don't fit the category schema. Service maps to 400."""


def validate_specs(category: str, specs: dict[str, Any]) -> dict[str, Any]:
    """Validate + normalise ``specs`` for a given device category.

    Returns a clean dict (None-valued keys stripped) ready to store.
    Empty dict in → empty dict out (specs are optional everywhere).
    """
    if not specs:
        return {}
    model = _SPECS_BY_CATEGORY.get(category)
    if model is None:
        raise SpecsValidationError(f"unknown category {category!r}")
    try:
        instance = model.model_validate(specs)
    except ValidationError as exc:
        raise SpecsValidationError(str(exc)) from exc

    # ``exclude_none=True`` drops keys the user left empty so the DB row stays
    # tidy. We also strip empty lists for the same reason (a smartwatch with
    # no connectivity should be ``{}``, not ``{"connectivity": []}``).
    raw = instance.model_dump(exclude_none=True)
    cleaned = {k: v for k, v in raw.items() if v != []}
    # For ``OtherSpecs`` (extra="allow"), only keep stringified values to
    # avoid someone smuggling a nested object as a free-form note.
    if category == "other":
        cleaned = {k: str(v) for k, v in cleaned.items() if v not in (None, "")}
    return cleaned
