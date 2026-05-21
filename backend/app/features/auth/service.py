"""Auth business logic.

The router and the bot both call into this module — never into the
repository or telegram-verifier directly. That way the rules of "what
counts as a valid login" live in exactly one place.

Closed-platform behaviour: ``login_via_telegram`` and ``login_via_password``
do **not** auto-create users. New shops/users come exclusively through the
admin panel (``app.features.admin.service.register_shop_with_owner``).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.core.security import create_access_token, hash_password, verify_password
from app.features.admin import service as admin_service
from app.features.admin.models import AttemptSource
from app.features.auth import repository as user_repo
from app.features.auth.models import User
from app.features.auth.telegram import InvalidInitData, verify_init_data


class AuthError(Exception):
    """Raised on any failed auth attempt — caller maps to 401/403."""


async def login_via_telegram(db: AsyncSession, init_data: str) -> tuple[User, str]:
    """Verify Telegram initData and return (user, JWT) for known users only.

    Unknown ``tg_id`` → ``AuthError`` + entry in ``access_attempts`` so the
    platform admin can review who tried to enter.
    """
    try:
        tg = verify_init_data(init_data)
    except InvalidInitData as exc:
        await admin_service.log_attempt(
            db,
            source=AttemptSource.TELEGRAM,
            identifier="?",
            success=False,
            reason=f"invalid initData: {exc}",
        )
        raise AuthError("invalid Telegram initData") from exc

    user = await user_repo.get_by_tg_id(db, tg.id)
    if user is None:
        await admin_service.log_attempt(
            db,
            source=AttemptSource.TELEGRAM,
            identifier=str(tg.id),
            tg_username=tg.username,
            success=False,
            reason="unknown tg_id (not registered by admin)",
        )
        raise AuthError("access denied — contact administrator")

    # Refresh username if Telegram has a fresher value, mark login.
    if tg.username and tg.username != user.tg_username:
        user.tg_username = tg.username
    user.last_login_at = now_utc()
    user.last_login_source = "telegram"

    await admin_service.log_attempt(
        db,
        source=AttemptSource.TELEGRAM,
        identifier=str(tg.id),
        tg_username=tg.username,
        success=True,
        user_id=user.id,
    )
    return user, create_access_token(user.id)


async def login_via_password(db: AsyncSession, login: str, password: str) -> tuple[User, str]:
    """Validate username + password and return (user, JWT) on success.

    Both unknown logins and wrong passwords return the same error to
    prevent account enumeration; both produce an ``access_attempts`` row.
    """
    user = await user_repo.get_by_login(db, login)
    if user is None or not user.password_hash:
        await admin_service.log_attempt(
            db,
            source=AttemptSource.LOGIN,
            identifier=login,
            success=False,
            reason="unknown login or no password set",
        )
        raise AuthError("invalid credentials")

    if not verify_password(password, user.password_hash):
        await admin_service.log_attempt(
            db,
            source=AttemptSource.LOGIN,
            identifier=login,
            success=False,
            reason="wrong password",
            user_id=user.id,
        )
        raise AuthError("invalid credentials")

    user.last_login_at = now_utc()
    user.last_login_source = "login"
    await admin_service.log_attempt(
        db,
        source=AttemptSource.LOGIN,
        identifier=login,
        success=True,
        user_id=user.id,
    )
    return user, create_access_token(user.id)


async def setup_password(
    db: AsyncSession, user_id: int, login: str, password: str
) -> User:
    """Attach a password fallback to an authenticated user."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise AuthError("user not found")

    existing = await user_repo.get_by_login(db, login)
    if existing is not None and existing.id != user.id:
        raise AuthError("login already taken")

    user.login = login
    user.password_hash = hash_password(password)
    return user
