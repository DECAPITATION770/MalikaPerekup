"""Database queries for the ``users`` table.

Repositories never raise HTTP errors — they return data or ``None`` and let
the service layer decide what that means for the caller.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def get_by_tg_id(db: AsyncSession, tg_id: int) -> User | None:
    result = await db.execute(select(User).where(User.tg_id == tg_id))
    return result.scalar_one_or_none()


async def get_by_login(db: AsyncSession, login: str) -> User | None:
    result = await db.execute(select(User).where(User.login == login))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, **fields) -> User:
    """Insert a new user and flush so ``user.id`` is populated."""
    user = User(**fields)
    db.add(user)
    await db.flush()
    return user
