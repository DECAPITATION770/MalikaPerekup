"""Device ORM model — one row per physical unit on the shop's shelf.

A device is the central entity of the system. Its life cycle:

    purchase  →  in_stock  →  sale  →  sold
                       ↘  reserved (held for a buyer)
                       ↘  returned (buyer brought it back)
                       ↘  written_off (broken / lost / stolen)

Devices are not created directly. The ``purchases`` feature creates a
device + purchase pair atomically — there is no such thing as a device
without a purchase record.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class DeviceCategory(StrEnum):
    """Top-level category — drives which spec template the form shows."""

    PHONE = "phone"
    TABLET = "tablet"
    LAPTOP = "laptop"
    SMARTWATCH = "smartwatch"
    ACCESSORY = "accessory"
    OTHER = "other"


class DeviceCondition(StrEnum):
    NEW = "new"
    GOOD = "good"
    NORMAL = "normal"
    BROKEN = "broken"


class DeviceStatus(StrEnum):
    IN_STOCK = "in_stock"
    RESERVED = "reserved"
    SOLD = "sold"
    RETURNED = "returned"
    WRITTEN_OFF = "written_off"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Multi-tenancy: every list / get query filters by ``shop_id``.
    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    category: Mapped[str] = mapped_column(String(16), nullable=False)
    brand: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)

    # Hardware identifiers — both nullable because the user enters them
    # later in many real cases (no time at the counter, missing box).
    imei: Mapped[str | None] = mapped_column(String(32), nullable=True)
    serial: Mapped[str | None] = mapped_column(String(64), nullable=True)

    condition: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=DeviceCondition.GOOD.value
    )

    # Free-form characteristics — schema depends on ``category`` and is
    # validated in the service layer (e.g. phones get ram/storage/color).
    specs: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, server_default="{}"
    )

    # Optional photos of the device itself (front, back, defects).
    photos: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    # Defect checklist from the purchase wizard (step 2): raw toggle keys
    # like ``"screen_replaced"``, ``"scratches"``. ``condition`` is derived
    # from this list on the frontend; we keep both so old filters keep working.
    defects: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=DeviceStatus.IN_STOCK.value
    )

    # 32-char hex token printed on the QR sticker. Lives forever — opening
    # ``{BOT_WEBAPP_URL}/d/{qr_token}`` always shows the device card.
    qr_token: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit columns — useful for "who added this" and "how long has it sat".
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
        # No two devices in the same shop can share an IMEI (safety: prevents
        # selling the same phone twice). NULLs are allowed multiple times,
        # which matches our "IMEI is optional" rule.
        UniqueConstraint("shop_id", "imei", name="uq_devices_shop_imei"),
        # Status + shop is the most common WHERE — speeds up the "Витрина" list.
        Index("ix_devices_shop_status", "shop_id", "status"),
    )
