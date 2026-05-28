"""Telegram WebApp initData verification.

Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl


class InvalidInitData(ValueError):
    """Raised when initData fails HMAC verification or is malformed/expired."""


@dataclass(frozen=True, slots=True)
class TelegramUser:
    id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    language_code: str | None


@dataclass(frozen=True, slots=True)
class VerifiedInitData:
    user: TelegramUser
    auth_date: int


def verify_init_data(
    init_data: str, bot_token: str, *, max_age_seconds: int = 86_400, now: float | None = None
) -> VerifiedInitData:
    """Verify Telegram WebApp initData and return the embedded user.

    Algorithm per Telegram docs:
    1. Parse query string into key=value pairs.
    2. Take `hash` field aside.
    3. Build data_check_string: sort remaining keys, join as `key=value\\n`.
    4. secret_key = HMAC_SHA256("WebAppData", bot_token).
    5. computed = HMAC_SHA256(secret_key, data_check_string), hex.
    6. computed must equal `hash`.
    """
    if not init_data:
        raise InvalidInitData("empty initData")

    pairs = dict(parse_qsl(init_data, strict_parsing=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise InvalidInitData("missing hash")

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed, received_hash):
        raise InvalidInitData("hash mismatch")

    try:
        auth_date = int(pairs.get("auth_date", "0"))
    except ValueError as exc:
        raise InvalidInitData("invalid auth_date") from exc

    current = now if now is not None else time.time()
    if auth_date <= 0 or current - auth_date > max_age_seconds:
        raise InvalidInitData("initData expired")

    user_json = pairs.get("user")
    if not user_json:
        raise InvalidInitData("missing user")
    try:
        user_data = json.loads(user_json)
    except json.JSONDecodeError as exc:
        raise InvalidInitData("invalid user JSON") from exc

    return VerifiedInitData(
        user=TelegramUser(
            id=int(user_data["id"]),
            username=user_data.get("username"),
            first_name=user_data.get("first_name"),
            last_name=user_data.get("last_name"),
            language_code=user_data.get("language_code"),
        ),
        auth_date=auth_date,
    )
