"""FastAPI dependencies shared across feature modules.

Each protected endpoint declares ``user: CurrentUser`` or ``shop: CurrentShop``
and gets the authenticated entities for free — routes never read JWTs or
load users/shops by hand.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import InvalidToken, decode_access_token

DbSession = Annotated[AsyncSession, Depends(get_db)]


# ─── JWT extraction ────────────────────────────────────────────────────


def _extract_bearer(authorization: str | None) -> str:
    """Pull the token out of an ``Authorization: Bearer <token>`` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1].strip()


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> int:
    """Return the authenticated user's id from the JWT (or dev bypass).

    Use this only when you need the bare id (avoids a DB round-trip). For
    the full ``User`` row, depend on ``CurrentUser`` instead.
    """
    settings = get_settings()
    # Defence in depth: the boot-time validator in `config.py` already
    # refuses to construct a Settings() with bypass enabled in prod, so
    # this branch can't be reached on a prod boot. Re-check anyway — a
    # mutated singleton or a forgotten test fixture should never quietly
    # return a fake user id under prod traffic.
    if settings.dev_auth_bypass and settings.dev_bypass_user_id_int is not None:
        if settings.is_prod:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="auth bypass enabled in prod — refusing request",
            )
        return settings.dev_bypass_user_id_int

    token = _extract_bearer(authorization)
    try:
        payload = decode_access_token(token)
    except InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )
    return int(sub)


CurrentUserId = Annotated[int, Depends(get_current_user_id)]


# ─── User and Shop loaders ─────────────────────────────────────────────
#
# These imports are local to the function body to avoid a top-level cycle:
# features import ``core.deps``, and we want to load feature models here.
# At call time the modules are fully initialised, so the lazy import is safe
# and free (Python caches the module object).


async def get_current_user(user_id: CurrentUserId, db: DbSession):
    """Load the authenticated ``User`` row from the database."""
    from app.features.auth import repository as user_repo

    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_current_shop(
    user: Annotated["User", Depends(get_current_user)],  # noqa: F821
    db: DbSession,
):
    """Load the shop the current user belongs to, or return 403.

    Returns 403 with explicit reason for any of:
    * user has no shop assigned (admin not yet registered them);
    * shop has been frozen by the platform admin (non-payment, abuse).
    """
    from app.features.shops import repository as shop_repo

    if user.shop_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No shop assigned — contact administrator",
        )
    shop = await shop_repo.get_by_id(db, user.shop_id)
    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found",
        )
    if shop.is_frozen:
        # Frontend uses this exact ``code`` to render the "shop frozen" screen.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "shop_frozen",
                "reason": shop.frozen_reason or "shop access suspended",
            },
        )
    return shop


# Re-exported type aliases for endpoint signatures. The string forward
# references resolve at endpoint-definition time, after both feature modules
# have been imported by ``app.main``.
from app.features.auth.models import User  # noqa: E402  (after dep funcs)
from app.features.shops.models import Shop  # noqa: E402

CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentShop = Annotated[Shop, Depends(get_current_shop)]
