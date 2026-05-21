"""Database queries for ``counterparties``.

Every query is filtered by ``shop_id`` — never expose another shop's data.
``deleted_at IS NULL`` is the soft-delete filter applied by default.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.counterparties.models import Counterparty


async def get_by_id(
    db: AsyncSession, counterparty_id: int, *, shop_id: int
) -> Counterparty | None:
    """Fetch one counterparty inside ``shop_id`` (returns None if hidden)."""
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == counterparty_id,
            Counterparty.shop_id == shop_id,
            Counterparty.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def find_by_phone(
    db: AsyncSession, phone: str, *, shop_id: int
) -> Counterparty | None:
    """Used during purchase/sale to suggest an existing counterparty."""
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.shop_id == shop_id,
            Counterparty.phone == phone,
            Counterparty.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def search(
    db: AsyncSession,
    *,
    shop_id: int,
    query: str | None,
    type_: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Counterparty], int]:
    """Search counterparties by name or phone, optionally filtered by ``type``.

    Returns ``(items, total)`` so the caller can build a paged response.
    """
    base = select(Counterparty).where(
        Counterparty.shop_id == shop_id,
        Counterparty.deleted_at.is_(None),
    )

    if type_ in ("seller", "buyer", "both"):
        # ``both`` rows always match either filter — mirrors UI expectation.
        if type_ == "both":
            base = base.where(Counterparty.type == "both")
        else:
            base = base.where(Counterparty.type.in_((type_, "both")))

    if query:
        like = f"%{query}%"
        base = base.where(
            or_(
                Counterparty.full_name.ilike(like),
                Counterparty.phone.ilike(like),
            )
        )

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar_one()

    items_q = (
        base.order_by(Counterparty.updated_at.desc()).limit(limit).offset(offset)
    )
    items = (await db.execute(items_q)).scalars().all()
    return list(items), total


async def create(db: AsyncSession, **fields) -> Counterparty:
    counterparty = Counterparty(**fields)
    db.add(counterparty)
    await db.flush()
    return counterparty
