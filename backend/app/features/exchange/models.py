"""CBU exchange-rate cache — one row per calendar date.

The Central Bank of Uzbekistan publishes a single official UZS-per-USD
rate per day. We mirror the latest value here so the purchase form can
suggest it without hitting cbu.uz on every page load. A daily scheduler
job (09:00 Asia/Tashkent) refreshes it.

This table is global reference data, **not** tenant-scoped: the official
rate is identical for every shop, so there is deliberately no ``shop_id``.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class CbuRateCache(Base):
    __tablename__ = "cbu_rate_cache"

    # The CBU publication date is the natural key — one official rate/day.
    date: Mapped[date] = mapped_column(Date, primary_key=True)

    # UZS per 1 USD. NUMERIC(14,4): cbu.uz publishes 2 dp, headroom is free.
    usd_rate: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    # When we fetched it — lets the UI flag a stale cache if cbu.uz is down.
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
