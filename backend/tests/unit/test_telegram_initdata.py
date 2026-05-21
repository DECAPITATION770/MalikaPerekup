"""Telegram initData verification — must reject any tampered payload."""

import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from app.core.config import get_settings
from app.features.auth.telegram import (
    INIT_DATA_TTL_SECONDS,
    InvalidInitData,
    verify_init_data,
)


def _signed_init_data(
    *,
    user_id: int = 12345,
    username: str = "alibek",
    auth_date: int | None = None,
) -> str:
    """Build a valid initData string signed with the test bot token."""
    auth_date = auth_date if auth_date is not None else int(time.time())
    user_payload = json.dumps(
        {"id": user_id, "first_name": "Alibek", "username": username}
    )
    pairs = {"auth_date": str(auth_date), "user": user_payload}
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))

    bot_token = get_settings().bot_token
    secret_key = hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    signature = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return urlencode({**pairs, "hash": signature})


def test_valid_initdata_returns_user():
    raw = _signed_init_data(user_id=999, username="malika_user")
    user = verify_init_data(raw)
    assert user.id == 999
    assert user.username == "malika_user"


def test_tampered_user_rejected():
    """Changing the user payload after signing must invalidate the hash."""
    raw = _signed_init_data(user_id=1)
    tampered = raw.replace("first_name=Alibek", "first_name=Hacker") if "first_name=" in raw else raw
    # Replace the user JSON manually since first_name is inside the JSON blob.
    tampered = raw.replace("Alibek", "Hacker")
    with pytest.raises(InvalidInitData):
        verify_init_data(tampered)


def test_missing_hash_rejected():
    raw = _signed_init_data()
    without_hash = "&".join(p for p in raw.split("&") if not p.startswith("hash="))
    with pytest.raises(InvalidInitData):
        verify_init_data(without_hash)


def test_expired_initdata_rejected():
    too_old = int(time.time()) - INIT_DATA_TTL_SECONDS - 60
    raw = _signed_init_data(auth_date=too_old)
    with pytest.raises(InvalidInitData):
        verify_init_data(raw)
