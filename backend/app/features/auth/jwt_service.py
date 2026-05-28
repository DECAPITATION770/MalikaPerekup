from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


class InvalidToken(ValueError):
    """Raised when JWT is malformed, expired, or signature mismatch."""


@dataclass(frozen=True, slots=True)
class TokenPayload:
    user_id: int
    tenant_id: int | None
    role: str


def issue(user_id: int, *, tenant_id: int | None, role: str) -> tuple[str, int]:
    """Issue a JWT. Returns (token, expires_in_seconds)."""
    ttl_seconds = settings.jwt_ttl_hours * 3600
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": str(user_id),
        "tid": tenant_id,
        "role": role,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, ttl_seconds


def verify(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise InvalidToken(str(exc)) from exc
    sub = payload.get("sub")
    role = payload.get("role")
    if not sub or not role:
        raise InvalidToken("missing claims")
    try:
        return TokenPayload(user_id=int(sub), tenant_id=payload.get("tid"), role=role)
    except (TypeError, ValueError) as exc:
        raise InvalidToken("invalid claims") from exc
