"""Database queries for ``catalog_models``.

Every query is filtered by ``shop_id`` — a shop never sees another shop's
templates (CLAUDE.md §6).
"""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import CatalogModel


async def get_by_id(
    db: AsyncSession, catalog_id: int, *, shop_id: int
) -> CatalogModel | None:
    """Fetch one template inside ``shop_id`` (None if it belongs elsewhere)."""
    result = await db.execute(
        select(CatalogModel).where(
            CatalogModel.id == catalog_id,
            CatalogModel.shop_id == shop_id,
        )
    )
    return result.scalar_one_or_none()


async def find_by_model(
    db: AsyncSession, *, shop_id: int, category: str, brand: str, model: str
) -> CatalogModel | None:
    """Case-insensitive lookup used by the upsert-on-purchase path."""
    result = await db.execute(
        select(CatalogModel).where(
            CatalogModel.shop_id == shop_id,
            CatalogModel.category == category,
            func.lower(CatalogModel.brand) == brand.strip().lower(),
            func.lower(CatalogModel.model) == model.strip().lower(),
        )
    )
    return result.scalar_one_or_none()


async def search(
    db: AsyncSession,
    *,
    shop_id: int,
    query: str | None,
    category: str | None,
    limit: int,
    offset: int,
) -> tuple[list[CatalogModel], int]:
    """Search templates by brand or model, optionally filtered by category.

    Returns ``(items, total)`` for a paged response.
    """
    base = select(CatalogModel).where(CatalogModel.shop_id == shop_id)

    if category:
        base = base.where(CatalogModel.category == category)

    if query:
        like = f"%{query}%"
        base = base.where(
            or_(
                CatalogModel.brand.ilike(like),
                CatalogModel.model.ilike(like),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    items = (
        (
            await db.execute(
                base.order_by(CatalogModel.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return list(items), total


async def create(db: AsyncSession, **fields) -> CatalogModel:
    item = CatalogModel(**fields)
    db.add(item)
    await db.flush()
    return item


async def delete(db: AsyncSession, item: CatalogModel) -> None:
    """Hard delete — templates carry no FK from deals, so removing one is safe."""
    await db.delete(item)
