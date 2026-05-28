"""Unit tests for Telegram initData verification (pure functions, no DB)."""

import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from app.features.auth.telegram import InvalidInitData, verify_init_data

BOT_TOKEN = "1234567:test-token"


def _make_init_data(
    bot_token: str, user: dict | None = None, auth_date: int | None = None
) -> str:
    user = user or {"id": 42, "username": "alice", "first_name": "Alice"}
    auth_date_s = str(auth_date if auth_date is not None else int(time.time()))
    pairs = {"user": json.dumps(user), "auth_date": auth_date_s}
    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    pairs["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode(pairs)


def test_verify_valid_init_data() -> None:
    init_data = _make_init_data(BOT_TOKEN)
    result = verify_init_data(init_data, BOT_TOKEN)
    assert result.user.id == 42
    assert result.user.username == "alice"
    assert result.user.first_name == "Alice"


def test_verify_rejects_invalid_hash() -> None:
    init_data = _make_init_data(BOT_TOKEN)
    with pytest.raises(InvalidInitData, match="hash mismatch"):
        verify_init_data(init_data, "different-token")


def test_verify_rejects_expired() -> None:
    expired_ts = int(time.time()) - 100_000  # ~28h ago, max_age default is 86400s
    init_data = _make_init_data(BOT_TOKEN, auth_date=expired_ts)
    with pytest.raises(InvalidInitData, match="expired"):
        verify_init_data(init_data, BOT_TOKEN)


def test_verify_rejects_empty() -> None:
    with pytest.raises(InvalidInitData, match="empty"):
        verify_init_data("", BOT_TOKEN)


def test_verify_rejects_missing_hash() -> None:
    # build a payload, then strip the hash field
    init_data = _make_init_data(BOT_TOKEN)
    stripped = "&".join(p for p in init_data.split("&") if not p.startswith("hash="))
    with pytest.raises(InvalidInitData, match="missing hash"):
        verify_init_data(stripped, BOT_TOKEN)
