"""Request and response shapes for ``/auth/*`` endpoints."""

from typing import Literal

from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    """Raw initData string forwarded from the Mini App."""

    init_data: str = Field(min_length=1)


class LoginRequest(BaseModel):
    """Username + password fallback login."""

    login: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class SetupPasswordRequest(BaseModel):
    """Set or change the password fallback (requires existing JWT)."""

    login: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user_id: int


class UserOut(BaseModel):
    id: int
    full_name: str
    language: Literal["ru", "uz"]
    tg_username: str | None = None
    phone: str | None = None
    has_password: bool
