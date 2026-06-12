"""HTTP endpoints for authentication."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.common.ratelimit import enforce_account_limit, login_rate_limit
from app.core.deps import CurrentUserId, DbSession
from app.features.auth import avatars
from app.features.auth import repository as user_repo
from app.features.auth import service
from app.features.auth.models import User
from app.features.auth.schemas import (
    LoginRequest,
    NotificationPrefsRequest,
    SetupPasswordRequest,
    TelegramAuthRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Tighter limit on password login (lower legitimate volume + higher
# brute-force risk) than on Telegram (verified by HMAC up front).
_login_throttle = login_rate_limit("auth.login", per_ip_limit=10, per_ip_window=60)
_telegram_throttle = login_rate_limit("auth.telegram", per_ip_limit=30, per_ip_window=60)


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        full_name=user.full_name,
        language=user.language,  # type: ignore[arg-type]  # checked at write time
        tg_username=user.tg_username,
        phone=user.phone,
        has_password=user.has_password,
        notifications_enabled="telegram" in (user.notification_channels or []),
        tg_connected=user.tg_id is not None,
        notify_tg_chat_id=user.notify_tg_chat_id,
    )


@router.post(
    "/telegram",
    response_model=TokenResponse,
    dependencies=[Depends(_telegram_throttle)],
)
async def login_via_telegram(
    req: TelegramAuthRequest,
    db: DbSession,
    request: Request,
    background_tasks: BackgroundTasks,
) -> TokenResponse:
    """Mini App auth: send ``initData``, receive a JWT.

    Creates the user on first call and refreshes their Telegram username
    on subsequent calls.
    """
    try:
        user, token = await service.login_via_telegram(db, req.init_data)
    except service.UserBlockedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, {"code": "user_blocked"}
        ) from exc
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    # Best-effort: cache the user's Telegram avatar for the admin Users view.
    bot = getattr(request.app.state, "bot", None)
    if bot is not None:
        background_tasks.add_task(avatars.refresh_avatar_bg, user.id, bot)
    return TokenResponse(access_token=token, user_id=user.id)


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(_login_throttle)],
)
async def login_via_password(req: LoginRequest, db: DbSession) -> TokenResponse:
    """Fallback auth used when Telegram is unavailable."""
    # Per-account window (complements the per-IP dependency above): 8 failed
    # tries per login per 15 min slows a distributed, IP-rotating brute-force.
    await enforce_account_limit(
        "auth.login.acct", req.login, limit=8, window_seconds=900
    )
    try:
        user, token = await service.login_via_password(db, req.login, req.password)
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return TokenResponse(access_token=token, user_id=user.id)


@router.post("/setup-password", response_model=UserOut)
async def setup_password(
    req: SetupPasswordRequest, user_id: CurrentUserId, db: DbSession
) -> UserOut:
    """Settings → Security: attach or change the login + password fallback."""
    try:
        user = await service.setup_password(db, user_id, req.login, req.password)
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return _user_out(user)


@router.get("/me", response_model=UserOut)
async def me(user_id: CurrentUserId, db: DbSession) -> UserOut:
    """Return the currently authenticated user — frontend calls this on boot."""
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return _user_out(user)


@router.patch("/me/notifications", response_model=UserOut)
async def update_notifications(
    req: NotificationPrefsRequest, user_id: CurrentUserId, db: DbSession
) -> UserOut:
    """Settings → Уведомления: toggle Telegram reminders + set override chat."""
    try:
        user = await service.update_notification_prefs(
            db,
            user_id,
            enabled=req.enabled,
            notify_tg_chat_id=req.notify_tg_chat_id,
        )
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _user_out(user)
