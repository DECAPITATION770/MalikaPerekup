"""Catalog (номенклатура) ORM model — a shop's reusable device templates.

Each row is one model the shop deals in (e.g. "Apple iPhone 14 Pro") with
its default specs and a representative photo. The purchase wizard reads
these to pre-fill a new device, so a perekupshchik stops re-typing the same
RAM/storage/colour every time.

Per-shop by design (CLAUDE.md §6): a template belongs to exactly one shop —
there is no shared global catalog. Templates are filled two ways:
* manually, from the Номенклатура screen;
* automatically, on every purchase via ``service.upsert_for_purchase`` —
  the model seen on a deal becomes (or refreshes) its template.
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class CatalogModel(Base):
    __tablename__ = "catalog_models"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Multi-tenancy: every template carries the shop it belongs to.
    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    # Mirrors device categories (phone/tablet/laptop/smartwatch/accessory/other).
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    brand: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)

    # Default specs in the same shape as ``Device.specs`` (ram_gb, storage_gb,
    # colour…) — validated against the category schema before write.
    default_specs: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict, server_default="{}"
    )

    # S3 keys for representative photos — served via presigned URL, never raw.
    photos: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    # How many purchases referenced this model — ranks "Частые" by frequency
    # (stable positions) instead of recency (which reshuffles every deal).
    purchase_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        # One template per (shop, category, brand, model). Matching on the
        # upsert path is case-insensitive in the repository, so this guards
        # against exact duplicates while leaving casing to the user.
        UniqueConstraint(
            "shop_id", "category", "brand", "model", name="uq_catalog_shop_model"
        ),
        # Speeds up brand/model search within a shop (combined with ILIKE).
        Index("ix_catalog_shop_brand", "shop_id", "brand"),
    )
