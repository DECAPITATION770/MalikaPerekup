"""Telegram profile-photo caching for the admin Users view.

Fetched fire-and-forget after a successful Telegram login, stored in object
storage (private), served to the admin via presigned URLs.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.common import storage
from app.common.dates import now_utc
from app.core.database import SessionFactory
from app.core.logging import logger
from app.features.auth import repository as user_repo
from app.features.auth.models import User

_REFRESH_EVERY = timedelta(days=7)


async def refresh_avatar(bot, db: AsyncSession, user: User) -> None:
    """Fetch the user's Telegram photo into object storage (best-effort)."""
    if user.tg_id is None:
        return
    if (
        user.avatar_fetched_at is not None
        and now_utc() - user.avatar_fetched_at < _REFRESH_EVERY
    ):
        return

    photos = await bot.get_user_profile_photos(user.tg_id, limit=1)
    if not getattr(photos, "total_count", 0) or not photos.photos:
        user.avatar_fetched_at = now_utc()
        await db.commit()
        return

    largest = photos.photos[0][-1]  # biggest PhotoSize of the first photo
    file = await bot.get_file(largest.file_id)
    buf = await bot.download_file(file.file_path)
    key = f"avatars/{user.id}.jpg"
    storage.upload(key, buf.read(), "image/jpeg")
    user.avatar_key = key
    user.avatar_fetched_at = now_utc()
    await db.commit()


async def refresh_avatar_bg(user_id: int, bot) -> None:
    """Background entrypoint: own session, swallow errors (fire-and-forget)."""
    try:
        async with SessionFactory() as db:
            user = await user_repo.get_by_id(db, user_id)
            if user is not None:
                await refresh_avatar(bot, db, user)
    except Exception as exc:  # noqa: BLE001 — never break login on avatar refresh
        logger.warning("avatar.refresh_failed", user_id=user_id, error=str(exc))
