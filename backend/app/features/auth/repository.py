from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.features.auth.telegram import TelegramUser


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_by_tg_id(session: AsyncSession, tg_id: int) -> User | None:
    result = await session.execute(select(User).where(User.tg_id == tg_id))
    return result.scalar_one_or_none()


async def upsert_from_telegram(session: AsyncSession, tg_user: TelegramUser) -> User:
    """Find user by tg_id or create. Update profile fields if changed."""
    user = await get_by_tg_id(session, tg_user.id)
    if user is None:
        user = User(
            tg_id=tg_user.id,
            tg_username=tg_user.username,
            tg_first_name=tg_user.first_name,
            tg_last_name=tg_user.last_name,
            language=tg_user.language_code or "ru",
        )
        session.add(user)
        await session.flush()
        return user

    # Refresh profile fields — they can change in Telegram.
    user.tg_username = tg_user.username
    user.tg_first_name = tg_user.first_name
    user.tg_last_name = tg_user.last_name
    await session.flush()
    return user
