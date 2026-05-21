"""Shop ORM model — one shop per Owner in MVP, multi-staff in stage 2.

A ``Shop`` row represents a physical retail point on the Malika market.
All business records (devices, purchases, sales, …) carry a ``shop_id``
foreign key so that multi-tenancy filtering is impossible to forget.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    """Human-readable name shown in the UI: e.g. ``Шерали | Малика, ряд 5``."""

    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    """User who created the shop. Permissions in stage 2 will hang off this."""

    language_default: Mapped[str] = mapped_column(
        String(2), nullable=False, server_default="ru"
    )
    """Default UI language for staff joining this shop in stage 2."""

    # ── Subscription (placeholder for monetisation, "trial" for everyone in MVP) ──
    plan: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="trial"
    )
    plan_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ── Admin freeze switch ──
    # When ``True``, every business endpoint returns 403 (see core/deps.py).
    # Used by the platform admin to suspend a shop for non-payment, abuse, etc.
    is_frozen: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    frozen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    frozen_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
