"""Cryptographic primitives shared by every auth path.

* JWT — encode/decode short-lived bearer tokens. Same token format whether
  the user logged in via Telegram initData or via login + password.
* Bcrypt — hash and verify password fallback (set in Settings → Security).
"""

from datetime import timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.common.dates import now_utc
from app.core.config import get_settings

# ─── JWT ──────────────────────────────────────────────────────────────


class InvalidToken(Exception):
    """Raised when a JWT is missing, malformed, or expired."""


def create_access_token(user_id: int, extra: dict[str, Any] | None = None) -> str:
    """Issue a JWT that identifies ``user_id`` for ``JWT_TTL_HOURS`` hours."""
    settings = get_settings()
    now = now_utc()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify ``token``. Raises ``InvalidToken`` on any failure."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidToken(str(exc)) from exc


# ─── Password (fallback auth) ─────────────────────────────────────────


def hash_password(plaintext: str) -> str:
    """Return a bcrypt hash suitable for storage."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plaintext.encode("utf-8"), salt).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    """Constant-time check of ``plaintext`` against ``hashed``."""
    return bcrypt.checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))
