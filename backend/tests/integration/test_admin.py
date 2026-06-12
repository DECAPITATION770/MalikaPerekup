"""End-to-end tests for the admin panel."""

from datetime import date
from decimal import Decimal

import pytest

from app.features.admin import repository as admin_repo
from app.features.admin import service as admin_service
from app.features.admin.models import AttemptSource, PlatformAdmin
from app.features.auth import repository as user_repo
from app.features.auth import service as auth_service
from app.features.devices import service as device_service
from app.features.shops import repository as shop_repo


@pytest.fixture
async def admin(db) -> PlatformAdmin:
    a = PlatformAdmin(tg_id=99001, full_name="Boss")
    db.add(a)
    await db.flush()
    return a


async def test_admin_creates_shop_with_owner(db, admin):
    """Admin provisions a new shop. User and Shop are atomically linked."""
    shop, user = await admin_service.register_shop_with_owner(
        db,
        name="New Shop",
        language_default="ru",
        owner_full_name="Sherali",
        owner_tg_id=11111,
        owner_tg_username="sherali",
        owner_phone="+998901112233",
        owner_login=None,
        owner_password=None,
    )
    assert user.shop_id == shop.id
    assert shop.owner_id == user.id
    assert shop.plan == "trial"
    assert shop.plan_until is not None


async def test_register_requires_tg_or_login(db, admin):
    """Owner without any auth path is rejected."""
    with pytest.raises(admin_service.ShopRegistrationError):
        await admin_service.register_shop_with_owner(
            db,
            name="Bad",
            language_default="ru",
            owner_full_name="Nobody",
            owner_tg_id=None,
            owner_tg_username=None,
            owner_phone=None,
            owner_login=None,
            owner_password=None,
        )


async def test_register_login_requires_password(db, admin):
    with pytest.raises(admin_service.ShopRegistrationError):
        await admin_service.register_shop_with_owner(
            db,
            name="Bad",
            language_default="ru",
            owner_full_name="Nobody",
            owner_tg_id=None,
            owner_tg_username=None,
            owner_phone=None,
            owner_login="someone",
            owner_password=None,
        )


async def test_register_rejects_duplicate_tg(db, admin):
    await admin_service.register_shop_with_owner(
        db, name="A", language_default="ru",
        owner_full_name="X", owner_tg_id=22222,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    with pytest.raises(admin_service.ShopRegistrationError):
        await admin_service.register_shop_with_owner(
            db, name="B", language_default="ru",
            owner_full_name="Y", owner_tg_id=22222,
            owner_tg_username=None, owner_phone=None,
            owner_login=None, owner_password=None,
        )


async def test_unknown_telegram_user_rejected_and_logged(db, admin):
    """Auth via Telegram for unknown tg_id → AuthError + access_attempts row."""
    # Sign valid initData for a user that is NOT registered.
    import hashlib
    import hmac
    import json
    import time
    from urllib.parse import urlencode

    from app.core.config import get_settings

    bot_token = get_settings().bot_token
    user_payload = json.dumps({"id": 99999, "first_name": "Stranger"})
    pairs = {"auth_date": str(int(time.time())), "user": user_payload}
    dcs = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    signature = hmac.new(secret_key, dcs.encode(), hashlib.sha256).hexdigest()
    init_data = urlencode({**pairs, "hash": signature})

    with pytest.raises(auth_service.AuthError):
        await auth_service.login_via_telegram(db, init_data)

    # Attempt was recorded for the admin to inspect.
    items, _ = await admin_repo.search_attempts(
        db,
        source=AttemptSource.TELEGRAM.value,
        success=False,
        date_from=None,
        date_to=None,
        limit=10,
        offset=0,
    )
    assert any(a.identifier == "99999" for a in items)


async def test_wrong_password_logged(db, admin):
    """Wrong password yields an access_attempts row even for known login."""
    shop, user = await admin_service.register_shop_with_owner(
        db, name="Z", language_default="ru",
        owner_full_name="Z", owner_tg_id=33333,
        owner_tg_username=None, owner_phone=None,
        owner_login="zzz", owner_password="correct-horse",
    )
    await db.flush()

    with pytest.raises(auth_service.AuthError):
        await auth_service.login_via_password(db, "zzz", "wrong-password")

    items, _ = await admin_repo.search_attempts(
        db,
        source=AttemptSource.LOGIN.value,
        success=False,
        date_from=None,
        date_to=None,
        limit=10,
        offset=0,
    )
    assert any(a.identifier == "zzz" for a in items)


async def test_freeze_blocks_business_endpoint(db, admin):
    """A frozen shop returns 403 from get_current_shop."""
    from fastapi import HTTPException

    from app.core.deps import get_current_shop

    shop, user = await admin_service.register_shop_with_owner(
        db, name="To freeze", language_default="ru",
        owner_full_name="X", owner_tg_id=44444,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    await db.flush()

    # Sanity: not frozen → returns the shop.
    result = await get_current_shop(user, db)
    assert result.id == shop.id

    # Freeze and verify the dependency rejects the user.
    await admin_service.freeze_shop(shop, reason="non-payment")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_shop(user, db)
    assert exc_info.value.status_code == 403

    # Unfreeze restores access.
    await admin_service.unfreeze_shop(shop)
    result = await get_current_shop(user, db)
    assert result.id == shop.id


async def test_set_owner_credentials_updates_login_and_hash(db, admin):
    shop, user = await admin_service.register_shop_with_owner(
        db, name="Cred", language_default="ru",
        owner_full_name="X", owner_tg_id=55555,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )

    await admin_service.set_owner_credentials(
        db, user, login="freshlogin", password="newpass-12345"
    )
    await db.flush()
    fetched = await user_repo.get_by_login(db, "freshlogin")
    assert fetched is not None
    assert fetched.id == user.id

    # Now login via password works
    user_back, token = await auth_service.login_via_password(
        db, "freshlogin", "newpass-12345"
    )
    assert user_back.id == user.id
    assert token


async def test_bootstrap_admins_seeds_only_when_empty(db):
    created = await admin_service.bootstrap_admins_if_needed(db, tg_ids=[11, 22])
    assert created == 2
    # Second call is a no-op even with new ids.
    created_again = await admin_service.bootstrap_admins_if_needed(db, tg_ids=[33])
    assert created_again == 0
    assert await admin_repo.count_admins(db) == 2


async def test_users_list_exposes_client_status_and_avatar(admin_client, db):
    from app.features.auth.models import User
    from app.features.shops.models import Shop

    # user with a paid (basic) shop → "client"
    u = User(full_name="Paid Owner", tg_id=810001)
    db.add(u)
    await db.flush()
    shop = Shop(name="PaidShop", language_default="ru", owner_id=u.id, plan="basic")
    db.add(shop)
    await db.flush()
    u.shop_id = shop.id
    # user without a shop → "no_shop"
    db.add(User(full_name="Orphan", tg_id=810002))
    await db.commit()

    r = await admin_client.get("/api/v1/admin/users")
    assert r.status_code == 200
    by_name = {row["full_name"]: row for row in r.json()["items"]}
    assert by_name["Paid Owner"]["client_status"] == "client"
    assert by_name["Orphan"]["client_status"] == "no_shop"
    assert "avatar_url" in by_name["Orphan"]
    assert by_name["Orphan"]["avatar_url"] is None
