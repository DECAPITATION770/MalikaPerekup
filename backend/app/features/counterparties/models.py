"""Counterparty ORM model — directory of sellers and buyers.

A ``Counterparty`` row represents a person the shop has dealt with at
least once. The same human can be both a seller (sold us a device) and a
buyer (bought one from us), so ``type`` distinguishes the role.

Why a separate table instead of fields on purchases/sales:
* repeat customers stop re-typing passport data;
* enables search by phone or name across the shop's history;
* lets us list "who owes us via Nasiya" by counterparty rather than by deal.
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class Counterparty(Base):
    __tablename__ = "counterparties"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Multi-tenancy: every record carries the shop it belongs to.
    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    # ``seller`` — sold a device to us; ``buyer`` — bought from us;
    # ``both`` — once was on each side. Service auto-promotes to "both".
    type: Mapped[str] = mapped_column(String(8), nullable=False, default="seller")

    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # ID document — type ("passport"/"id_card"/"driver_license"/...) is free
    # text in MVP; tighten with an enum later if needed.
    doc_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    doc_number: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ``doc_photos`` is a list of S3 keys — fetched via presigned URL when
    # the user opens the counterparty card.
    doc_photos: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    # Optional Telegram username so we can DM the buyer about Nasiya later.
    tg_username: Mapped[str | None] = mapped_column(String(64), nullable=True)

    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Soft delete: hide instead of erase, because purchases/sales still
    # reference this row via FK.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # CLAUDE.md §10 — when a counterparty is soft-deleted we owe the user
    # cleanup of their passport scans from object storage. The
    # ``cleanup_deleted_counterparty_files`` job flips this true once the
    # ``doc_photos`` keys have been removed from MinIO/R2.
    files_cleaned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        # Speeds up search-by-phone within a shop (the most common lookup).
        Index("ix_counterparties_shop_phone", "shop_id", "phone"),
        # Speeds up search-by-name (combined with ILIKE in repository).
        Index("ix_counterparties_shop_name", "shop_id", "full_name"),
    )
