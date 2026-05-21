"""Admin-specific JWT issuance and FastAPI dependencies.

Admin tokens reuse the same JWT format as user tokens, with two key
differences:
* ``is_admin = True`` claim — gate for ``/admin/*`` endpoints;
* ``sub`` carries ``platform_admins.id`` (NOT ``users.id``) so admin
  identity is fully separate from shop-owner identity.
"""

from datetime import timedelta
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, status
from jose import jwt

from app.common.dates import now_utc
from app.core.config import get_settings
from app.core.deps import DbSession, _extract_bearer
from app.core.security import InvalidToken, decode_access_token
from app.features.admin import repository as admin_repo
from app.features.admin.models import PlatformAdmin


def create_admin_token(admin_id: int) -> str:
    """Issue a JWT that identifies a platform admin for ``JWT_TTL_HOURS``."""
    settings = get_settings()
    now = now_utc()
    payload: dict[str, Any] = {
        "sub": str(admin_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
        "is_admin": True,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_admin(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> PlatformAdmin:
    """Resolve and authorise the current platform admin from the JWT.

    Returns 401/403 for any of:
    * missing or invalid JWT;
    * JWT lacks ``is_admin = true`` claim;
    * admin row not found or marked inactive.
    """
    token = _extract_bearer(authorization)
    try:
        payload = decode_access_token(token)
    except InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not payload.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    admin = await admin_repo.get_admin_by_id(db, int(sub))
    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found or inactive",
        )
    return admin


CurrentAdmin = Annotated[PlatformAdmin, Depends(get_current_admin)]
