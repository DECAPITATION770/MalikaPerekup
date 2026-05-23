"""Request and response shapes for ``/catalog/*`` endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.features.devices.schemas import DeviceCategoryLiteral


class CatalogModelCreate(BaseModel):
    category: DeviceCategoryLiteral
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    default_specs: dict[str, Any] = Field(default_factory=dict)
    photos: list[str] = Field(default_factory=list, max_length=3)


class CatalogModelUpdate(BaseModel):
    """All fields optional — PATCH semantics."""

    category: DeviceCategoryLiteral | None = None
    brand: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=120)
    default_specs: dict[str, Any] | None = None
    photos: list[str] | None = Field(default=None, max_length=3)


class CatalogModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: DeviceCategoryLiteral
    brand: str
    model: str
    default_specs: dict[str, Any]
    photos: list[str]
    # Short-lived signed GET URLs for ``photos`` — filled by the router.
    photo_urls: list[str] = Field(default_factory=list)
    purchase_count: int
    created_at: datetime
    updated_at: datetime


class UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=120)


class UploadUrlResponse(BaseModel):
    url: str
    key: str
