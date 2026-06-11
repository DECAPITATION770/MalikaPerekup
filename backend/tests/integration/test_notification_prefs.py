"""Settings → Уведомления: toggle the Telegram channel and set an override
chat. Tested against real PostgreSQL (CLAUDE.md §13)."""

from app.features.admin import service as admin_service
from app.features.auth import service as auth_service


async def _make_owner(db, tg_id):
    shop, user = await admin_service.register_shop_with_owner(
        db, name="A", language_default="ru",
        owner_full_name="Owner", owner_tg_id=tg_id,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    await db.flush()
    return user


async def test_disable_clears_telegram_channel(db):
    user = await _make_owner(db, 7001)
    assert "telegram" in user.notification_channels  # default on

    updated = await auth_service.update_notification_prefs(
        db, user.id, enabled=False, notify_tg_chat_id=None
    )
    assert updated.notification_channels == []  # dispatcher will enqueue nothing


async def test_enable_with_override_chat(db):
    user = await _make_owner(db, 7002)
    await auth_service.update_notification_prefs(
        db, user.id, enabled=False, notify_tg_chat_id=None
    )

    updated = await auth_service.update_notification_prefs(
        db, user.id, enabled=True, notify_tg_chat_id=-1001234567890
    )
    assert updated.notification_channels == ["telegram"]
    assert updated.notify_tg_chat_id == -1001234567890


async def test_clearing_override_falls_back_to_dm(db):
    user = await _make_owner(db, 7003)
    await auth_service.update_notification_prefs(
        db, user.id, enabled=True, notify_tg_chat_id=555
    )
    updated = await auth_service.update_notification_prefs(
        db, user.id, enabled=True, notify_tg_chat_id=None
    )
    assert updated.notify_tg_chat_id is None  # → channel sends to tg_id


async def test_unknown_user_raises(db):
    try:
        await auth_service.update_notification_prefs(
            db, 999999, enabled=True, notify_tg_chat_id=None
        )
        assert False, "expected AuthError"
    except auth_service.AuthError:
        pass
