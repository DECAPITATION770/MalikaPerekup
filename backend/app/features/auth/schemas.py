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

    # ── Notification preferences (Settings → Уведомления) ──
    notifications_enabled: bool = True
    """True when the Telegram channel is in ``notification_channels``."""
    tg_connected: bool = False
    """True when the user has a ``tg_id`` — i.e. they /start-ed the bot, so
    reminders to their personal DM can actually be delivered."""
    notify_tg_chat_id: int | None = None
    """Optional override chat for reminders; NULL = personal DM (``tg_id``)."""


class NotificationPrefsRequest(BaseModel):
    """Update Telegram reminder preferences for the authenticated user."""

    enabled: bool
    notify_tg_chat_id: int | None = Field(
        default=None,
        description="Override chat id for reminders; null = personal DM.",
    )
