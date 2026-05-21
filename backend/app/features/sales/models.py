"""Sale ORM model — record of selling one device to a buyer.

Unlike ``Purchase``, ``Sale`` is NOT one-to-one with the device: a device
can be sold, returned, and sold again, producing multiple ``Sale`` rows.
The current "active" sale is the most recent one whose status is not
``cancelled``.

``profit_uzs`` is denormalised: stored once at sale creation time so that
historical reports remain consistent even if the linked purchase row is
later edited within its 24-hour window. The single source of truth for
the formula is ``app.features.sales.profit_calc.compute_profit``.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

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


class SaleType(StrEnum):
    CASH = "cash"
    NASIYA = "nasiya"


class SaleStatus(StrEnum):
    """Lifecycle of a sale row.

    * ``active``    — sale is in force; for nasiya the schedule is being paid.
    * ``returned``  — buyer brought the device back; refunds handled manually.
    * ``cancelled`` — sale was created in error and rolled back within 24h.
    """

    ACTIVE = "active"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)

    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    counterparty_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("counterparties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Buyer snapshot (mirrors Purchase pattern — keep historical state) ──
    buyer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    buyer_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    buyer_doc_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    buyer_doc_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    buyer_photos: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    # ── Money ──
    sale_type: Mapped[str] = mapped_column(
        String(8), nullable=False, server_default=SaleType.CASH.value
    )

    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    sale_price_uzs: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    sale_price_usd: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    exchange_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 4), nullable=True
    )

    # Pinned at sale time so reports never recompute it.
    profit_uzs: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    purchase_price_uzs_snapshot: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False
    )

    sale_date: Mapped[date] = mapped_column(Date, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(12), nullable=False, server_default=SaleStatus.ACTIVE.value
    )
    return_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

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
        # Powers the "сегодня / 7д / 30д" dashboards.
        Index("ix_sales_shop_date", "shop_id", "sale_date"),
        # Speeds up the "active nasiya per shop" lookup.
        Index("ix_sales_shop_status", "shop_id", "status"),
    )
