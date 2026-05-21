"""Request and response shapes for ``/shops/*`` endpoints."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ShopCreate(BaseModel):
    """Onboarding payload: a freshly authed user creates their first shop."""

    name: str = Field(min_length=2, max_length=120)
    language_default: Literal["ru", "uz"] = "ru"


class ShopUpdate(BaseModel):
    """Partial update from Settings → Shop profile."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    language_default: Literal["ru", "uz"] | None = None


class ShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    language_default: Literal["ru", "uz"]
    plan: str
    plan_until: date | None
    created_at: datetime
