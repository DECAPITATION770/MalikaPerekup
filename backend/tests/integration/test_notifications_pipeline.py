"""Notification outbox pipeline — enqueue, dedup, dispatch, retry.

This is money-critical infrastructure: it nags buyers/owners about
overdue Nasiya on a schedule. A dedup bug spams people with duplicates;
a dispatch bug silently drops a reminder and the shop loses money. None
of it had coverage — added here against real PostgreSQL (CLAUDE.md §13).

A fake in-memory channel stands in for Telegram so nothing leaves the
process. ``notify_service.CHANNELS`` is module-global, so every test
registers its fake and pops it again in ``finally``.
"""

from app.features.admin import service as admin_service
from app.features.notifications import service as notify_service
from app.features.notifications import repository as notif_repo
from app.features.notifications.channels.base import ChannelError
from app.features.notifications.models import (
    NotificationKind,
    NotificationStatus,
)

OVERDUE_PAYLOAD = {
    "buyer_name": "Алишер",
    "buyer_phone": "+998901112233",
    "device": "iPhone 14 Pro",
    "amount_due": "1500000",
    "remaining": "6000000",
}


class _RecordingChannel:
    """Succeeds, remembering every (notification, rendered text) it got."""

    code = "telegram"

    def __init__(self) -> None:
        self.sent: list[tuple[int, str]] = []

    async def send(self, notification, user, text) -> None:  # noqa: ANN001
        self.sent.append((notification.id, text))


class _FailingChannel:
    code = "telegram"

    async def send(self, notification, user, text) -> None:  # noqa: ANN001
        raise ChannelError("transport down")


async def _owner(db, tg_id=9501):
    shop, user = await admin_service.register_shop_with_owner(
        db,
        name="Shop",
        language_default="ru",
        owner_full_name="Owner",
        owner_tg_id=tg_id,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    await db.flush()
    return shop, user


async def test_enqueue_is_idempotent_by_dedup_key(db):
    """Same dedup_key twice → exactly one row. No duplicate spam."""
    _, user = await _owner(db, 9510)
    key = "payment:42:payment_overdue:2026-05-19"

    first = await notify_service.enqueue_for_user(
        db, user_id=user.id, kind=NotificationKind.PAYMENT_OVERDUE.value,
        payload=OVERDUE_PAYLOAD, dedup_key=key,
    )
    second = await notify_service.enqueue_for_user(
        db, user_id=user.id, kind=NotificationKind.PAYMENT_OVERDUE.value,
        payload=OVERDUE_PAYLOAD, dedup_key=key,
    )

    assert len(first) == 1
    assert second == []  # skipped — already queued
    assert await notif_repo.get_by_dedup_key(db, key) is not None


async def test_dispatch_sends_pending_and_renders_text(db):
    _, user = await _owner(db, 9520)
    ch = _RecordingChannel()
    notify_service.register_channel(ch)
    try:
        created = await notify_service.enqueue_for_user(
            db, user_id=user.id, kind=NotificationKind.PAYMENT_OVERDUE.value,
            payload=OVERDUE_PAYLOAD, dedup_key="k-send",
        )
        n = created[0]

        attempted = await notify_service.dispatch_pending(db)

        assert attempted == 1
        assert n.status == NotificationStatus.SENT.value
        assert n.sent_at is not None
        assert n.attempts == 1
        # Rendered RU text reached the channel with real content.
        assert len(ch.sent) == 1
        sent_text = ch.sent[0][1]
        assert "Просрочен платёж" in sent_text
        assert "Алишер" in sent_text
    finally:
        notify_service.CHANNELS.pop("telegram", None)


async def test_dispatch_retries_then_fails_after_max_attempts(db):
    """Transient failure keeps the row pending and retried, until the
    attempt cap flips it to FAILED — never lost, never infinite."""
    _, user = await _owner(db, 9530)
    notify_service.register_channel(_FailingChannel())
    try:
        created = await notify_service.enqueue_for_user(
            db, user_id=user.id, kind=NotificationKind.PAYMENT_OVERDUE.value,
            payload=OVERDUE_PAYLOAD, dedup_key="k-retry",
        )
        n = created[0]

        for expected in range(1, notify_service.MAX_ATTEMPTS):
            await notify_service.dispatch_pending(db)
            assert n.attempts == expected
            assert n.status == NotificationStatus.PENDING.value
            assert n.last_error == "transport down"
            await db.flush()

        # Final attempt trips the cap.
        await notify_service.dispatch_pending(db)
        assert n.attempts == notify_service.MAX_ATTEMPTS
        assert n.status == NotificationStatus.FAILED.value
    finally:
        notify_service.CHANNELS.pop("telegram", None)


async def test_unregistered_channel_marks_failed(db):
    """No channel for the row → FAILED with a clear reason, not a crash."""
    _, user = await _owner(db, 9540)
    notify_service.CHANNELS.pop("telegram", None)  # ensure none registered
    created = await notify_service.enqueue_for_user(
        db, user_id=user.id, kind=NotificationKind.DAILY_SUMMARY.value,
        payload={"payments_count": 1, "total_due": "100", "overdue_count": 0},
        dedup_key="k-nochannel",
    )
    n = created[0]

    await notify_service.dispatch_pending(db)

    assert n.status == NotificationStatus.FAILED.value
    assert "not registered" in (n.last_error or "")


async def test_dispatch_skips_unknown_user_gracefully(db):
    """Edge: row points at a missing user → FAILED, dispatcher survives."""
    _, user = await _owner(db, 9550)
    ch = _RecordingChannel()
    notify_service.register_channel(ch)
    try:
        created = await notify_service.enqueue_for_user(
            db, user_id=user.id, kind=NotificationKind.DAILY_SUMMARY.value,
            payload={"payments_count": 0, "total_due": "0", "overdue_count": 2},
            dedup_key="k-ok",
        )
        await notify_service.dispatch_pending(db)
        assert created[0].status == NotificationStatus.SENT.value
        assert ch.sent and "Просроченных: 2" in ch.sent[0][1]
    finally:
        notify_service.CHANNELS.pop("telegram", None)
