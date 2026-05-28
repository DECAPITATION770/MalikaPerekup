from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.features.auth import jwt_service, repository
from app.features.auth.dependencies import current_user
from app.features.auth.models import User
from app.features.auth.schemas import (
    TelegramLoginRequest,
    TokenResponse,
    UserResponse,
)
from app.features.auth.telegram import InvalidInitData, TelegramUser, verify_init_data

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/telegram", response_model=TokenResponse)
async def login_telegram(
    body: TelegramLoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """Verify Telegram initData and issue a JWT.

    When DEV_AUTH_BYPASS=true, init_data is ignored and a stub user (tg_id=1) is used.
    The prod guard in app/main.py ensures bypass cannot run in production.
    """
    if settings.dev_auth_bypass:
        tg_user = TelegramUser(
            id=1, username="devuser", first_name="Dev", last_name=None, language_code="ru"
        )
    else:
        if not settings.bot_token:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="BOT_TOKEN not configured",
            )
        try:
            verified = verify_init_data(body.init_data, settings.bot_token)
        except InvalidInitData as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
            ) from exc
        tg_user = verified.user

    user = await repository.upsert_from_telegram(session, tg_user)
    await session.commit()

    token, ttl = jwt_service.issue(user.id)
    return TokenResponse(access_token=token, expires_in=ttl)


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[User, Depends(current_user)]) -> UserResponse:
    return UserResponse(
        id=user.id,
        tg_id=user.tg_id,
        tg_username=user.tg_username,
        tg_first_name=user.tg_first_name,
        language=user.language,
    )
