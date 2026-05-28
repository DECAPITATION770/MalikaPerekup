from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import ROLE_SUPER_ADMIN, User
from app.features.auth.telegram import TelegramUser


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def find_by_tg_id(session: AsyncSession, tg_id: int) -> User | None:
    result = await session.execute(select(User).where(User.tg_id == tg_id))
    return result.scalar_one_or_none()


async def find_invited_by_username(session: AsyncSession, username: str) -> User | None:
    """Find a user invited by @username but not yet logged in (tg_id IS NULL)."""
    if not username:
        return None
    result = await session.execute(
        select(User).where(
            func.lower(User.tg_username) == username.lower(),
            User.tg_id.is_(None),
        )
    )
    return result.scalar_one_or_none()


def _refresh_profile(user: User, tg_user: TelegramUser) -> None:
    user.tg_username = tg_user.username
    user.tg_first_name = tg_user.first_name
    user.tg_last_name = tg_user.last_name


async def get_or_create_super_admin(session: AsyncSession, tg_user: TelegramUser) -> User:
    """Race-safe upsert via Postgres INSERT ... ON CONFLICT DO UPDATE.

    Two concurrent /api/auth/telegram requests (e.g. React StrictMode) used to lose
    the SELECT-then-INSERT race and the second call hit a unique-constraint violation.
    Using the unique index on tg_id as the conflict target makes this atomic.
    """
    profile = {
        "tg_username": tg_user.username,
        "tg_first_name": tg_user.first_name,
        "tg_last_name": tg_user.last_name,
    }
    stmt = (
        pg_insert(User)
        .values(tenant_id=None, role=ROLE_SUPER_ADMIN, tg_id=tg_user.id, **profile)
        .on_conflict_do_update(
            index_elements=["tg_id"],
            set_={**profile, "role": ROLE_SUPER_ADMIN, "updated_at": func.now()},
        )
    )
    await session.execute(stmt)
    user = await find_by_tg_id(session, tg_user.id)
    assert user is not None, "upsert must have produced a row"
    return user


async def login_tenant_user(session: AsyncSession, tg_user: TelegramUser) -> User | None:
    """Find existing tenant user (by tg_id, or bind invited username).

    Returns None if not invited (caller raises 403).
    """
    user = await find_by_tg_id(session, tg_user.id)
    if user is None and tg_user.username:
        user = await find_invited_by_username(session, tg_user.username)
        if user is not None:
            # Bind tg_id permanently to this invited user — future lookups go by tg_id.
            user.tg_id = tg_user.id
    if user is None:
        return None
    _refresh_profile(user, tg_user)
    await session.flush()
    return user
