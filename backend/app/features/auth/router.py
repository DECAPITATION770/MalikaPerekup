from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.features.auth import jwt_service, repository
from app.features.auth.dependencies import CurrentUser, current_user
from app.features.auth.schemas import (
    TelegramLoginRequest,
    TokenResponse,
    UserResponse,
)
from app.features.auth.telegram import InvalidInitData, TelegramUser, verify_init_data
from app.features.tenants.models import Tenant

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Stub user used when DEV_AUTH_BYPASS=true (browser dev without Telegram).
# Treated as super-admin so the admin UI is testable in browser.
_DEV_BYPASS_TG_USER = TelegramUser(
    id=1, username="devadmin", first_name="Dev", last_name=None, language_code="ru"
)


def _resolve_tg_user(init_data: str) -> TelegramUser:
    if settings.dev_auth_bypass:
        return _DEV_BYPASS_TG_USER
    if not settings.bot_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="BOT_TOKEN not configured",
        )
    try:
        return verify_init_data(init_data, settings.bot_token).user
    except InvalidInitData as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc


@router.post("/telegram", response_model=TokenResponse)
async def login_telegram(
    body: TelegramLoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """Verify Telegram identity, resolve role, issue JWT.

    Resolution order:
    1. tg_id ∈ SUPER_ADMIN_TG_IDS (or dev-bypass) → upsert as super-admin.
    2. Existing User with that tg_id → owner login (after tenant.is_active check).
    3. Invited user with matching @username and no tg_id → bind tg_id, log in.
    4. None of the above → 403.
    """
    tg_user = _resolve_tg_user(body.init_data)

    is_super = tg_user.id in settings.super_admin_tg_ids or settings.dev_auth_bypass
    if is_super:
        user = await repository.get_or_create_super_admin(session, tg_user)
    else:
        found = await repository.login_tenant_user(session, tg_user)
        if found is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="not invited — contact admin",
            )
        if found.tenant_id is not None:
            tenant = await session.get(Tenant, found.tenant_id)
            if tenant is None or not tenant.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="tenant suspended",
                )
        user = found

    await session.commit()
    token, ttl = jwt_service.issue(user.id, tenant_id=user.tenant_id, role=user.role)
    return TokenResponse(access_token=token, expires_in=ttl)


@router.get("/me", response_model=UserResponse)
async def me(
    auth: Annotated[CurrentUser, Depends(current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserResponse:
    user = await repository.get_by_id(session, auth.id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    return UserResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        role=user.role,
        tg_id=user.tg_id,
        tg_username=user.tg_username,
        tg_first_name=user.tg_first_name,
        language=user.language,
    )
