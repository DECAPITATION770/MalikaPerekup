"""Purchase ORM model — record of buying one device from a person.

A ``Purchase`` is created together with its ``Device`` in one transaction
(see ``purchases.service.create_purchase``). The link is one-to-one:
``device_id`` is unique, so a given physical unit is purchased exactly once.

Counterparty (the seller) is optional. The form pre-fills it via the
counterparties directory if the user types a phone we have seen before.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)

    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    # One-to-one with the device: deleting the device cascades the purchase.
    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Optional link to the directory entry — null means a one-off seller
    # whose data lives only on this purchase row.
    counterparty_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("counterparties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Seller snapshot (always present even when counterparty_id is set,
    #    so historical records remain readable if the directory entry is
    #    later edited). ──
    seller_name: Mapped[str] = mapped_column(String(120), nullable=False)
    seller_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    seller_doc_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    seller_doc_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    seller_photos: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    # ── Money (Decimal, never float) ──
    # The user enters the amount in either UZS or USD. ``price_uzs`` is
    # always populated — for USD deals it's computed via ``exchange_rate``
    # captured at the moment of purchase. Reports always use ``price_uzs``.
    currency: Mapped[str] = mapped_column(String(3), nullable=False)  # "UZS" | "USD"
    price_uzs: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    price_usd: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    exchange_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 4), nullable=True
    )

    # The actual transaction date can differ from ``created_at`` — the user
    # may register a deal a day late. Stored as DATE because we don't care
    # about the exact second.
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)

    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        # Powers the date-range filter on the purchases list.
        Index("ix_purchases_shop_date", "shop_id", "purchase_date"),
    )
