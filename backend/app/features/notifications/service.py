"""Notification orchestration — enqueue, dispatch, channel registry.

Public surface:
* ``enqueue_for_user(...)`` — add a row to the outbox (with dedup);
* ``dispatch_pending(...)`` — called every few seconds by the scheduler;
* ``register_channel(...)`` — done once at startup with a real Telegram bot.

Channels are looked up by their ``code`` attribute. New channels (SMS,
push, email) plug in without touching the dispatcher.
"""

from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.features.auth import repository as user_repo
from app.features.notifications import repository as repo
from app.features.notifications.channels.base import Channel, ChannelError
from app.features.notifications.models import (
    Notification,
    NotificationStatus,
)
from app.features.notifications.render import render

# Populated by ``register_channel`` during application startup. Module-level
# state is acceptable here because channels are tied to process lifetime
# (one Telegram bot per process).
CHANNELS: dict[str, Channel] = {}

MAX_ATTEMPTS = 5
DISPATCH_BATCH = 50


def register_channel(channel: Channel) -> None:
    """Make a channel discoverable to the dispatcher."""
    CHANNELS[channel.code] = channel


# ─── Enqueue ──────────────────────────────────────────────────────────


async def enqueue_for_user(
    db: AsyncSession,
    *,
    user_id: int,
    kind: str,
    payload: dict[str, Any],
    scheduled_for: datetime | None = None,
    dedup_key: str | None = None,
) -> list[Notification]:
    """Queue one row per channel the user opted into.

    Idempotent when ``dedup_key`` is set: if a row with the same key is
    already in the table (any status), we skip enqueuing.
    """
    if dedup_key:
        existing = await repo.get_by_dedup_key(db, dedup_key)
        if existing is not None:
            return []

    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        return []

    created: list[Notification] = []
    for channel_code in user.notification_channels or ["telegram"]:
        notification = Notification(
            user_id=user_id,
            channel=channel_code,
            kind=kind,
            payload=payload,
            scheduled_for=scheduled_for,
            status=NotificationStatus.PENDING.value,
            dedup_key=dedup_key,
        )
        await repo.add(db, notification)
        created.append(notification)
    return created


# ─── Dispatch ─────────────────────────────────────────────────────────


async def _send_one(db: AsyncSession, notification: Notification) -> None:
    """Send a single notification or mark it failed permanently."""
    notification.attempts += 1

    user = await user_repo.get_by_id(db, notification.user_id)
    if user is None:
        notification.status = NotificationStatus.FAILED.value
        notification.last_error = "user not found"
        return

    channel = CHANNELS.get(notification.channel)
    if channel is None:
        notification.status = NotificationStatus.FAILED.value
        notification.last_error = f"channel {notification.channel!r} not registered"
        return

    try:
        text = render(notification, lang=user.language)  # type: ignore[arg-type]
        await channel.send(notification, user, text)
    except ChannelError as exc:
        notification.last_error = str(exc)
        if notification.attempts >= MAX_ATTEMPTS:
            notification.status = NotificationStatus.FAILED.value
        # else: leaves status=pending for the next dispatcher tick.
        return

    notification.status = NotificationStatus.SENT.value
    notification.sent_at = now_utc()


async def dispatch_pending(db: AsyncSession, *, batch: int = DISPATCH_BATCH) -> int:
    """Send all due notifications. Returns how many we attempted."""
    pending = await repo.list_due(db, limit=batch)
    for notification in pending:
        await _send_one(db, notification)
    return len(pending)
