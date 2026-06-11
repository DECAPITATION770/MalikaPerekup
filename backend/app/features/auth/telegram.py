"""Verification of Telegram Mini App ``initData``.

Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

The Mini App passes a query-string ``initData`` to our backend. We must
prove that the string was signed by Telegram with our bot token before
we trust any field inside (especially the ``user`` payload).
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl

from app.core.config import get_settings

# initData older than this is rejected — protects against replay if a token leaks.
# Telegram's own recommendation is "as short as you can tolerate"; one hour
# matches what BotFather examples use and gives the Mini App plenty of
# time to negotiate auth across a flaky connection without leaving a
# multi-day replay window open.
INIT_DATA_TTL_SECONDS = 3600


class InvalidInitData(Exception):
    """Raised when ``initData`` fails any verification step."""


@dataclass(frozen=True)
class TelegramUser:
    """The ``user`` field extracted from a verified ``initData``."""

    id: int
    first_name: str
    last_name: str | None
    username: str | None
    language_code: str | None

    @property
    def full_name(self) -> str:
        return " ".join(filter(None, [self.first_name, self.last_name])) or "User"


def verify_init_data(raw: str) -> TelegramUser:
    """Verify ``raw`` initData and return the parsed Telegram user.

    Steps (per Telegram spec):
    1. Parse the query string into ``key=value`` pairs.
    2. Pop the ``hash`` field and reconstruct the ``data_check_string`` from
       the remaining pairs sorted alphabetically.
    3. Derive the secret key as ``HMAC_SHA256("WebAppData", bot_token)``.
    4. Compute ``HMAC_SHA256(secret_key, data_check_string)``.
    5. Compare to the received hash in constant time.
    6. Reject if ``auth_date`` is missing or older than ``INIT_DATA_TTL_SECONDS``.
    """
    pairs = dict(parse_qsl(raw, keep_blank_values=True))

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise InvalidInitData("missing hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))

    secret_key = hmac.new(
        b"WebAppData",
        get_settings().bot_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise InvalidInitData("hash mismatch")

    auth_date = int(pairs.get("auth_date") or 0)
    if auth_date == 0:
        raise InvalidInitData("missing auth_date")
    if time.time() - auth_date > INIT_DATA_TTL_SECONDS:
        raise InvalidInitData("initData expired")

    user_json = pairs.get("user")
    if not user_json:
        raise InvalidInitData("missing user payload")
    try:
        user_obj: dict[str, Any] = json.loads(user_json)
    except json.JSONDecodeError as exc:
        raise InvalidInitData("user payload is not valid JSON") from exc

    return TelegramUser(
        id=int(user_obj["id"]),
        first_name=str(user_obj.get("first_name") or ""),
        last_name=user_obj.get("last_name"),
        username=user_obj.get("username"),
        language_code=user_obj.get("language_code"),
    )
