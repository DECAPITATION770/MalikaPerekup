"""Database queries for the ``purchases`` table."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.devices.models import Device
from app.features.purchases.models import Purchase


async def get_by_id(db: AsyncSession, purchase_id: int, *, shop_id: int) -> Purchase | None:
    result = await db.execute(
        select(Purchase).where(Purchase.id == purchase_id, Purchase.shop_id == shop_id)
    )
    return result.scalar_one_or_none()


async def get_by_device(db: AsyncSession, device_id: int, *, shop_id: int) -> Purchase | None:
    """Used by the device card to render purchase details on one screen."""
    result = await db.execute(
        select(Purchase).where(
            Purchase.device_id == device_id, Purchase.shop_id == shop_id
        )
    )
    return result.scalar_one_or_none()


async def get_last_with_device(
    db: AsyncSession, *, shop_id: int
) -> tuple[Purchase, Device] | None:
    """Most recent purchase in the shop, joined with its device.

    Powers GET /purchases/last — the "🔁 Повторить последнюю" card on
    step 1 of the wizard. ``None`` when the shop has no purchases yet.
    """
    stmt = (
        select(Purchase, Device)
        .join(Device, Device.id == Purchase.device_id)
        .where(Purchase.shop_id == shop_id)
        .order_by(Purchase.purchase_date.desc(), Purchase.id.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    return row[0], row[1]


async def search(
    db: AsyncSession,
    *,
    shop_id: int,
    date_from: date | None,
    date_to: date | None,
    counterparty_id: int | None,
    limit: int,
    offset: int,
) -> tuple[list[tuple[Purchase, str | None, str | None, str | None, str | None]], int]:
    """List purchases joined with device brand/model/imei/category so list
    rows can show the human-readable device label without an N+1 fetch."""
    base = (
        select(
            Purchase,
            Device.brand,
            Device.model,
            Device.imei,
            Device.category,
        )
        .join(Device, Device.id == Purchase.device_id)
        .where(Purchase.shop_id == shop_id)
    )
    if date_from is not None:
        base = base.where(Purchase.purchase_date >= date_from)
    if date_to is not None:
        base = base.where(Purchase.purchase_date <= date_to)
    if counterparty_id is not None:
        base = base.where(Purchase.counterparty_id == counterparty_id)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(Purchase.purchase_date.desc(), Purchase.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(r[0], r[1], r[2], r[3], r[4]) for r in rows], total


async def price_hint(
    db: AsyncSession, *, shop_id: int, brand: str, model: str
) -> tuple[int, "Decimal | None", "Decimal | None"]:
    """``(count, last_price_uzs, avg_price_uzs)`` for past buys of brand+model.

    Powers the wizard's step 4 hint: "is this price normal for this shop?"
    Match is case-insensitive so "iPhone 15" and "iphone 15" share history.
    Empty history → ``(0, None, None)`` and the UI shows "first time".
    """
    from decimal import Decimal  # local import — Decimal only used here

    last_subq = (
        select(Purchase.price_uzs)
        .join(Device, Device.id == Purchase.device_id)
        .where(
            Purchase.shop_id == shop_id,
            func.lower(Device.brand) == brand.lower(),
            func.lower(Device.model) == model.lower(),
        )
        .order_by(Purchase.purchase_date.desc(), Purchase.id.desc())
        .limit(1)
        .scalar_subquery()
    )

    stmt = (
        select(
            func.count(Purchase.id),
            func.avg(Purchase.price_uzs),
            last_subq.label("last_price"),
        )
        .join(Device, Device.id == Purchase.device_id)
        .where(
            Purchase.shop_id == shop_id,
            func.lower(Device.brand) == brand.lower(),
            func.lower(Device.model) == model.lower(),
        )
    )
    count, avg, last = (await db.execute(stmt)).one()
    if not count:
        return 0, None, None
    # ``avg`` comes back as Decimal from PostgreSQL Numeric.
    avg_d: Decimal | None = Decimal(avg) if avg is not None else None
    last_d: Decimal | None = Decimal(last) if last is not None else None
    return int(count), last_d, avg_d


async def add(db: AsyncSession, purchase: Purchase) -> Purchase:
    db.add(purchase)
    await db.flush()
    return purchase
