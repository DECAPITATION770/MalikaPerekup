"""Database queries for the ``shops`` table."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.shops.models import Shop


async def get_by_id(db: AsyncSession, shop_id: int) -> Shop | None:
    return await db.get(Shop, shop_id)


async def get_by_owner(db: AsyncSession, owner_id: int) -> Shop | None:
    """Return the shop owned by ``owner_id`` — MVP guarantees at most one."""
    result = await db.execute(select(Shop).where(Shop.owner_id == owner_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, **fields) -> Shop:
    shop = Shop(**fields)
    db.add(shop)
    await db.flush()
    return shop
