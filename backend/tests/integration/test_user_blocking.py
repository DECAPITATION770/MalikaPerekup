import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token, hash_password
from app.features.auth.models import User


def _signed_init_data(tg_id: int) -> str:
    """Valid initData signed with the test bot token (mirrors
    tests/unit/test_telegram_initdata.py::_signed_init_data)."""
    user_payload = json.dumps({"id": tg_id, "first_name": "B"})
    pairs = {"auth_date": str(int(time.time())), "user": user_payload}
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(
        b"WebAppData", get_settings().bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    sig = hmac.new(secret, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
    return urlencode({**pairs, "hash": sig})


def test_token_carries_src_claim():
    token = create_access_token(1, extra={"src": "telegram"})
    payload = decode_access_token(token)
    assert payload["src"] == "telegram"


@pytest.mark.asyncio
async def test_password_login_token_has_login_src(db):
    from app.features.auth import service

    user = User(full_name="Pass User", login="passuser",
                password_hash=hash_password("secret123"))
    db.add(user)
    await db.commit()

    _, token = await service.login_via_password(db, "passuser", "secret123")
    assert decode_access_token(token)["src"] == "login"


def _disable_bypass(monkeypatch):
    """conftest enables DEV_AUTH_BYPASS — turn it off so the real JWT path
    (and thus the src-claim guard) actually runs for these HTTP tests."""
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "dev_auth_bypass", False)


@pytest.mark.asyncio
async def test_blocked_user_telegram_session_403(client, db, monkeypatch):
    _disable_bypass(monkeypatch)
    user = User(full_name="Blocked", tg_id=700001, is_blocked=True)
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, extra={"src": "telegram"})
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "user_blocked"


@pytest.mark.asyncio
async def test_blocked_user_password_session_ok(client, db, monkeypatch):
    _disable_bypass(monkeypatch)
    user = User(full_name="Blocked Pass", tg_id=700002, is_blocked=True)
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, extra={"src": "login"})
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_unblock_restores_telegram_access(client, db, monkeypatch):
    _disable_bypass(monkeypatch)
    user = User(full_name="Toggle", tg_id=700003, is_blocked=True)
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, extra={"src": "telegram"})
    blocked = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert blocked.status_code == 403

    user.is_blocked = False
    await db.commit()
    ok = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_login_via_telegram_blocked(db):
    from app.features.auth import service

    user = User(full_name="Blocked TG", tg_id=700010, is_blocked=True)
    db.add(user)
    await db.commit()

    with pytest.raises(service.UserBlockedError):
        await service.login_via_telegram(db, _signed_init_data(700010))
