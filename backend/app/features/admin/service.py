"""Admin business logic.

Public surface used by the admin router and bootstrap hook:

* ``log_attempt`` — write an entry to ``access_attempts`` (called from many places)
* ``login_admin_via_telegram`` / ``login_admin_via_password``
* ``register_shop_with_owner`` — atomic create of User + Shop
* ``freeze_shop`` / ``unfreeze_shop``
* ``set_owner_credentials``
* ``bootstrap_admins_if_needed`` — seeds the first admin from env
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc, today_tashkent
from app.core.security import hash_password, verify_password
from app.features.admin import repository as admin_repo
from app.features.admin.auth import create_admin_token
from app.features.admin.models import AccessAttempt, AttemptSource, PlatformAdmin
from app.features.auth import repository as user_repo
from app.features.auth.models import User
from app.features.auth.telegram import InvalidInitData, verify_init_data
from app.features.shops import repository as shop_repo
from app.features.shops.models import Shop

TRIAL_DAYS = 30


# ─── Errors ────────────────────────────────────────────────────────────


class AdminError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class AdminAuthError(AdminError):
    """Bad credentials, unknown admin, inactive admin."""


class ShopRegistrationError(AdminError):
    """Conflict during shop registration (duplicate tg_id, login, …)."""


class AdminValidationError(AdminError):
    """Bad admin payload — no auth method, or login/password mismatch."""


class AdminConflictError(AdminError):
    """Duplicate tg_id or login when creating an admin."""


class AdminLockoutError(AdminError):
    """Refused: would deactivate yourself or the last active admin."""


# ─── Access attempt logging ────────────────────────────────────────────


async def log_attempt(
    db: AsyncSession,
    *,
    source: AttemptSource | str,
    identifier: str,
    success: bool,
    reason: str | None = None,
    tg_username: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    user_id: int | None = None,
) -> AccessAttempt:
    """Record any login attempt — invoked from auth services and the bot."""
    attempt = AccessAttempt(
        source=source.value if isinstance(source, AttemptSource) else source,
        identifier=identifier,
        success=success,
        reason=reason,
        tg_username=tg_username,
        ip_address=ip_address,
        user_agent=user_agent,
        user_id=user_id,
    )
    return await admin_repo.add_attempt(db, attempt)


# ─── Admin authentication ──────────────────────────────────────────────


async def login_admin_via_telegram(
    db: AsyncSession, init_data: str
) -> tuple[PlatformAdmin, str]:
    try:
        tg = verify_init_data(init_data)
    except InvalidInitData as exc:
        await log_attempt(
            db,
            source=AttemptSource.ADMIN_TELEGRAM,
            identifier="?",
            success=False,
            reason=f"invalid initData: {exc}",
        )
        raise AdminAuthError("invalid Telegram initData") from exc

    admin = await admin_repo.get_admin_by_tg_id(db, tg.id)
    if admin is None or not admin.is_active:
        await log_attempt(
            db,
            source=AttemptSource.ADMIN_TELEGRAM,
            identifier=str(tg.id),
            tg_username=tg.username,
            success=False,
            reason="not an active admin",
        )
        raise AdminAuthError("admin access denied")

    if tg.username and tg.username != admin.tg_username:
        admin.tg_username = tg.username
    admin.last_login_at = now_utc()

    await log_attempt(
        db,
        source=AttemptSource.ADMIN_TELEGRAM,
        identifier=str(tg.id),
        tg_username=tg.username,
        success=True,
        user_id=admin.id,
    )
    return admin, create_admin_token(admin.id)


async def login_admin_via_password(
    db: AsyncSession, login: str, password: str
) -> tuple[PlatformAdmin, str]:
    admin = await admin_repo.get_admin_by_login(db, login)
    # Generic message for unknown login OR wrong password (no enumeration).
    if admin is None or not admin.password_hash or not admin.is_active:
        await log_attempt(
            db,
            source=AttemptSource.ADMIN_LOGIN,
            identifier=login,
            success=False,
            reason="unknown login or no password set",
        )
        raise AdminAuthError("invalid credentials")

    if not verify_password(password, admin.password_hash):
        await log_attempt(
            db,
            source=AttemptSource.ADMIN_LOGIN,
            identifier=login,
            success=False,
            reason="wrong password",
            user_id=admin.id,
        )
        raise AdminAuthError("invalid credentials")

    admin.last_login_at = now_utc()
    await log_attempt(
        db,
        source=AttemptSource.ADMIN_LOGIN,
        identifier=login,
        success=True,
        user_id=admin.id,
    )
    return admin, create_admin_token(admin.id)


# ─── Shop & owner provisioning ─────────────────────────────────────────


async def register_shop_with_owner(
    db: AsyncSession,
    *,
    name: str,
    language_default: str,
    owner_full_name: str,
    owner_tg_id: int | None,
    owner_tg_username: str | None,
    owner_phone: str | None,
    owner_login: str | None,
    owner_password: str | None,
) -> tuple[Shop, User]:
    """Create a User + Shop pair atomically and link them."""
    if owner_tg_id is None and owner_login is None:
        raise ShopRegistrationError(
            "owner must have either Telegram ID or login set"
        )
    if owner_login and not owner_password:
        raise ShopRegistrationError(
            "owner_password is required when owner_login is set"
        )

    if owner_tg_id is not None:
        existing = await user_repo.get_by_tg_id(db, owner_tg_id)
        if existing is not None:
            raise ShopRegistrationError(
                f"user with tg_id={owner_tg_id} already exists"
            )

    if owner_login is not None:
        existing = await user_repo.get_by_login(db, owner_login)
        if existing is not None:
            raise ShopRegistrationError(
                f"user with login={owner_login!r} already exists"
            )

    user = await user_repo.create(
        db,
        tg_id=owner_tg_id,
        tg_username=owner_tg_username,
        full_name=owner_full_name,
        language=language_default,
        phone=owner_phone,
        login=owner_login,
        password_hash=hash_password(owner_password) if owner_password else None,
    )

    shop = await shop_repo.create(
        db,
        name=name,
        owner_id=user.id,
        language_default=language_default,
        plan="trial",
        plan_until=today_tashkent() + timedelta(days=TRIAL_DAYS),
    )
    user.shop_id = shop.id
    return shop, user


async def update_shop_admin_fields(
    shop: Shop,
    *,
    plan: str | None = None,
    plan_until: date | None = None,
) -> Shop:
    if plan is not None:
        shop.plan = plan
    if plan_until is not None:
        shop.plan_until = plan_until
    return shop


async def freeze_shop(shop: Shop, *, reason: str | None = None) -> Shop:
    shop.is_frozen = True
    shop.frozen_at = now_utc()
    shop.frozen_reason = reason
    return shop


async def unfreeze_shop(shop: Shop) -> Shop:
    shop.is_frozen = False
    shop.frozen_at = None
    shop.frozen_reason = None
    return shop


async def set_owner_credentials(
    db: AsyncSession,
    user: User,
    *,
    login: str | None = None,
    password: str | None = None,
) -> User:
    if login is not None:
        existing = await user_repo.get_by_login(db, login)
        if existing is not None and existing.id != user.id:
            raise ShopRegistrationError(f"login {login!r} already taken")
        user.login = login
    if password is not None:
        user.password_hash = hash_password(password)
    return user


# ─── Admin management (from the panel) ─────────────────────────────────


async def create_admin(
    db: AsyncSession,
    *,
    full_name: str,
    tg_id: int | None = None,
    tg_username: str | None = None,
    login: str | None = None,
    password: str | None = None,
) -> PlatformAdmin:
    """Create a new platform admin from the panel.

    Same auth-method rules as a shop owner: needs Telegram OR login, and a
    login is useless without a password.
    """
    if tg_id is None and login is None:
        raise AdminValidationError("admin must have either Telegram ID or login set")
    if login and not password:
        raise AdminValidationError("password is required when login is set")
    if password and not login:
        raise AdminValidationError("login is required when password is set")

    if tg_id is not None and await admin_repo.get_admin_by_tg_id(db, tg_id):
        raise AdminConflictError(f"admin with tg_id={tg_id} already exists")
    if login is not None and await admin_repo.get_admin_by_login(db, login):
        raise AdminConflictError(f"admin with login={login!r} already exists")

    admin = PlatformAdmin(
        full_name=full_name,
        tg_id=tg_id,
        tg_username=tg_username,
        login=login,
        password_hash=hash_password(password) if password else None,
        is_active=True,
    )
    return await admin_repo.add_admin(db, admin)


async def update_admin(
    db: AsyncSession,
    admin: PlatformAdmin,
    *,
    acting_admin_id: int,
    full_name: str | None = None,
    tg_username: str | None = None,
    password: str | None = None,
    is_active: bool | None = None,
) -> PlatformAdmin:
    """Patch an admin. Guards against locking everyone out of the panel."""
    if is_active is False:
        if admin.id == acting_admin_id:
            raise AdminLockoutError("you cannot deactivate your own account")
        if admin.is_active and await admin_repo.count_active_admins(
            db, exclude_id=admin.id
        ) == 0:
            raise AdminLockoutError("cannot deactivate the last active admin")

    if password is not None:
        if not admin.login:
            raise AdminValidationError(
                "cannot set a password for an admin without a login"
            )
        admin.password_hash = hash_password(password)
    if full_name is not None:
        admin.full_name = full_name
    if tg_username is not None:
        admin.tg_username = tg_username
    if is_active is not None:
        admin.is_active = is_active
    return admin


# ─── Bootstrap (called from FastAPI lifespan) ──────────────────────────


async def bootstrap_admins_if_needed(
    db: AsyncSession,
    *,
    tg_ids: list[int],
    login: str = "",
    password: str = "",
    name: str = "Admin",
) -> int:
    """Seed initial admins from env when the table is empty.

    Supports two modes (both can be active simultaneously):
    - Telegram IDs — Telegram-only auth, no password.
    - login + password — password auth, no Telegram required.

    Returns the number of rows created (0 if already bootstrapped).
    """
    if not tg_ids and not login:
        return 0
    if await admin_repo.count_admins(db) > 0:
        return 0

    created = 0
    for tg_id in tg_ids:
        await admin_repo.add_admin(
            db,
            PlatformAdmin(tg_id=tg_id, full_name=f"Bootstrap admin {tg_id}", is_active=True),
        )
        created += 1

    if login and password:
        await admin_repo.add_admin(
            db,
            PlatformAdmin(
                login=login,
                password_hash=hash_password(password),
                full_name=name,
                is_active=True,
            ),
        )
        created += 1

    return created


def client_status(shop, today) -> str:
    """Derive the platform-client status badge from a user's shop.

    Priority: no shop > frozen > expired plan > paid (basic) > trial.
    """
    if shop is None:
        return "no_shop"
    if shop.is_frozen:
        return "frozen"
    if shop.plan_until is not None and shop.plan_until < today:
        return "expired"
    if shop.plan == "basic":
        return "client"
    return "trial"


async def block_user(user: User) -> None:
    """Block the user's Telegram/initData access. Login/password unaffected."""
    user.is_blocked = True
    user.blocked_at = now_utc()


async def unblock_user(user: User) -> None:
    """Lift the Telegram-access block."""
    user.is_blocked = False
    user.blocked_at = None


async def update_contact(user: User, phone, note) -> None:
    """Set the owner's phone + admin contact note (platform admin only)."""
    user.phone = phone
    user.admin_contact_note = note
