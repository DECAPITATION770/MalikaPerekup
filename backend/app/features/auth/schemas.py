from pydantic import BaseModel, Field


class TelegramLoginRequest(BaseModel):
    init_data: str = Field(
        default="",
        description="Raw initData from Telegram WebApp. Empty when DEV_AUTH_BYPASS=true.",
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserResponse(BaseModel):
    id: int
    tenant_id: int | None
    role: str
    tg_id: int | None
    tg_username: str | None
    tg_first_name: str | None
    language: str
