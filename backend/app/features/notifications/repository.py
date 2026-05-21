"""Database queries for the ``notifications`` outbox."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.features.notifications.models import Notification, NotificationStatus


async def get_by_dedup_key(
    db: AsyncSession, dedup_key: str
) -> Notification | None:
    """Used by ``enqueue`` to skip duplicates safely."""
    result = await db.execute(
        select(Notification).where(Notification.dedup_key == dedup_key)
    )
    return result.scalar_one_or_none()


async def list_due(
    db: AsyncSession, *, limit: int = 100
) -> list[Notification]:
    """Pending rows ready to send (``scheduled_for`` is NULL or in the past)."""
    now = now_utc()
    result = await db.execute(
        select(Notification)
        .where(
            Notification.status == NotificationStatus.PENDING.value,
            (Notification.scheduled_for.is_(None))
            | (Notification.scheduled_for <= now),
        )
        .order_by(Notification.scheduled_for.asc().nulls_first(), Notification.id)
        .limit(limit)
    )
    return list(result.scalars().all())


async def add(db: AsyncSession, notification: Notification) -> Notification:
    db.add(notification)
    await db.flush()
    return notification
