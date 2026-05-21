"""Queries for the CBU rate cache and a shop's last manually-used rate.

``last_used_rate`` is shop-scoped (CLAUDE.md §6): the rate one shop typed
is never offered to another. ``latest_cbu_rate`` is global by design — the
official CBU rate is the same for everyone.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.features.exchange.models import CbuRateCache
from app.features.purchases.models import Purchase


async def latest_cbu_rate(db: AsyncSession) -> CbuRateCache | None:
    """Most recent cached CBU row, or None if we never fetched one."""
    return (
        await db.execute(
            select(CbuRateCache).order_by(CbuRateCache.date.desc()).limit(1)
        )
    ).scalar_one_or_none()


async def upsert_cbu_rate(
    db: AsyncSession, *, rate_date: date, usd_rate: Decimal
) -> None:
    """Insert the day's CBU rate, or overwrite it if the date already exists.

    cbu.uz can revise a published rate; the date is the key, so a second
    fetch for the same day updates in place rather than duplicating.
    """
    existing = await db.get(CbuRateCache, rate_date)
    if existing is None:
        db.add(CbuRateCache(date=rate_date, usd_rate=usd_rate))
    else:
        existing.usd_rate = usd_rate
        existing.fetched_at = now_utc()


async def last_used_rate(
    db: AsyncSession, *, shop_id: int
) -> tuple[Decimal, date] | None:
    """The ``exchange_rate`` of this shop's most recent USD purchase.

    Returns ``(rate, purchase_date)`` or None when the shop has no USD
    deal yet — the frontend then offers only the CBU rate.
    """
    row = (
        await db.execute(
            select(Purchase.exchange_rate, Purchase.purchase_date)
            .where(
                Purchase.shop_id == shop_id,
                Purchase.currency == "USD",
                Purchase.exchange_rate.is_not(None),
            )
            .order_by(
                Purchase.purchase_date.desc(), Purchase.created_at.desc()
            )
            .limit(1)
        )
    ).first()
    if row is None:
        return None
    return row[0], row[1]
