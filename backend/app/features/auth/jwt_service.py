from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


class InvalidToken(ValueError):
    """Raised when JWT is malformed, expired, or signature mismatch."""


def issue(user_id: int) -> tuple[str, int]:
    """Issue a JWT for the given user_id. Returns (token, expires_in_seconds)."""
    ttl_seconds = settings.jwt_ttl_hours * 3600
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
    payload = {"sub": str(user_id), "exp": expires_at}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, ttl_seconds


def verify(token: str) -> int:
    """Verify token and return the embedded user_id."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise InvalidToken(str(exc)) from exc
    sub = payload.get("sub")
    if not sub:
        raise InvalidToken("missing sub")
    try:
        return int(sub)
    except ValueError as exc:
        raise InvalidToken("invalid sub") from exc
