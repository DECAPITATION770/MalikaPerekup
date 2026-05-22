"""Database queries for the ``devices`` table.

Every read enforces ``shop_id`` so cross-shop access is impossible —
``get_by_token`` is the only function exposed without a shop filter, but
the router checks the shop right after calling it.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.devices.models import Device
from app.features.purchases.models import Purchase


async def get_by_id(db: AsyncSession, device_id: int, *, shop_id: int) -> Device | None:
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.shop_id == shop_id)
    )
    return result.scalar_one_or_none()


async def get_by_token(db: AsyncSession, qr_token: str) -> Device | None:
    """Look up by QR token only — caller must verify shop ownership."""
    result = await db.execute(select(Device).where(Device.qr_token == qr_token))
    return result.scalar_one_or_none()


async def get_by_imei(db: AsyncSession, imei: str, *, shop_id: int) -> Device | None:
    """Used by the purchase form to warn before duplicate entry."""
    result = await db.execute(
        select(Device).where(Device.imei == imei, Device.shop_id == shop_id)
    )
    return result.scalar_one_or_none()


async def search(
    db: AsyncSession,
    *,
    shop_id: int,
    query: str | None,
    status: str | None,
    category: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Device], int]:
    """Filter the catalogue by status / category / free-text query.

    Free-text matches IMEI, serial, brand, and model with ILIKE.
    Returns ``(items, total)`` for paged responses.
    """
    base = select(Device).where(Device.shop_id == shop_id)

    if status:
        base = base.where(Device.status == status)
    if category:
        base = base.where(Device.category == category)
    if query:
        like = f"%{query}%"
        base = base.where(
            or_(
                Device.imei.ilike(like),
                Device.serial.ilike(like),
                Device.brand.ilike(like),
                Device.model.ilike(like),
            )
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    items = (
        await db.execute(
            base.order_by(Device.created_at.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return list(items), total


# Whitelisted sort orders (col name never built from user input). Each entry
# is a tuple so price sorts get a stable secondary key.
_SORT_MAP = {
    "recent": (Device.created_at.desc(), Device.id.desc()),
    "days": (Device.created_at.asc(), Device.id.asc()),
    "price_asc": (Purchase.price_uzs.asc().nullslast(), Device.id.desc()),
    "price_desc": (Purchase.price_uzs.desc().nullslast(), Device.id.desc()),
}


async def search_with_purchase(
    db: AsyncSession,
    *,
    shop_id: int,
    query: str | None,
    status: str | None,
    category: str | None,
    limit: int,
    offset: int,
    condition: str | None = None,
    brand: str | None = None,
    price_min: Decimal | None = None,
    price_max: Decimal | None = None,
    sort: str = "recent",
) -> tuple[list[tuple[Device, Decimal | None, date | None]], int]:
    """Same as :func:`search` but LEFT JOINs the purchase row so the Stock
    table shows ``price_uzs`` / ``purchase_date`` without an N+1, plus extra
    filters (condition, brand, price range) and sort options.

    Price filters and price sorts reference ``Purchase.price_uzs``; a device
    with no purchase row is excluded by a price filter (and sorts NULLS LAST).
    LEFT JOIN (not INNER) so an orphan device still appears otherwise —
    defence-in-depth (CLAUDE.md §1).
    """

    def _apply(stmt):
        stmt = stmt.where(Device.shop_id == shop_id)
        if status:
            stmt = stmt.where(Device.status == status)
        if category:
            stmt = stmt.where(Device.category == category)
        if condition:
            stmt = stmt.where(Device.condition == condition)
        if brand:
            stmt = stmt.where(func.lower(Device.brand) == brand.lower())
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Device.imei.ilike(like),
                    Device.serial.ilike(like),
                    Device.brand.ilike(like),
                    Device.model.ilike(like),
                )
            )
        if price_min is not None:
            stmt = stmt.where(Purchase.price_uzs >= price_min)
        if price_max is not None:
            stmt = stmt.where(Purchase.price_uzs <= price_max)
        return stmt

    base = _apply(
        select(Device, Purchase.price_uzs, Purchase.purchase_date).outerjoin(
            Purchase, Purchase.device_id == Device.id
        )
    )

    # Count distinct devices (one-to-one keeps it equal to row count today, but
    # the join + DISTINCT keeps it correct if a device ever has many purchases).
    count_stmt = _apply(
        select(func.count(func.distinct(Device.id)))
        .select_from(Device)
        .outerjoin(Purchase, Purchase.device_id == Device.id)
    )
    total = (await db.execute(count_stmt)).scalar_one()

    order = _SORT_MAP.get(sort, _SORT_MAP["recent"])
    rows = (
        await db.execute(base.order_by(*order).limit(limit).offset(offset))
    ).all()
    return [(r[0], r[1], r[2]) for r in rows], total


async def suggest(
    db: AsyncSession,
    *,
    shop_id: int,
    field: str,
    q: str,
    brand: str | None,
    limit: int,
) -> list[str]:
    """Distinct brand/model values from THIS shop's own device history.

    Powers the purchase form autocomplete. Most-used value first so the
    shop's common brands surface at the top. ``field`` is mapped through a
    fixed dict (never string-formatted into SQL) so it cannot inject a
    column name. For models, an optional ``brand`` narrows the list.
    """
    column = {"brand": Device.brand, "model": Device.model}[field]

    stmt = (
        select(column)
        .where(Device.shop_id == shop_id)
        .group_by(column)
        .order_by(func.count(Device.id).desc(), column.asc())
        .limit(limit)
    )
    if q:
        # Prefix match: this completes what the user is typing from the
        # start (deliberately stricter than the contains-match used by the
        # free-text ``search`` — a type-ahead and a search box differ).
        stmt = stmt.where(column.ilike(f"{q}%"))
    if field == "model" and brand:
        stmt = stmt.where(Device.brand == brand)

    return list((await db.execute(stmt)).scalars().all())


async def recent_models(
    db: AsyncSession, *, shop_id: int, limit: int
) -> list[tuple[str, str, str]]:
    """Top-``limit`` distinct (brand, model, category) triples for this shop,
    ordered by most-recent purchase first.

    Powers step 1 of the purchase wizard ("Что покупаем?") — the chip grid
    shows what the shop actually buys often, so 1 tap fills the device
    type in 80% of cases.
    """
    last_seen = func.max(Device.created_at).label("last_seen")
    stmt = (
        select(Device.brand, Device.model, Device.category, last_seen)
        .where(Device.shop_id == shop_id)
        .group_by(Device.brand, Device.model, Device.category)
        .order_by(last_seen.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [(brand, model, category) for brand, model, category, _ in rows]


async def add(db: AsyncSession, device: Device) -> Device:
    """Insert an already-built ``Device`` and flush so ``id`` is populated.

    Devices are constructed by the purchases service (not via direct API),
    so this helper takes the prepared object instead of kwargs.
    """
    db.add(device)
    await db.flush()
    return device
