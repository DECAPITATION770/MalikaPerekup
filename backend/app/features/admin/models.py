"""Platform-admin and access-attempt ORM models.

* ``PlatformAdmin`` is a SEPARATE entity from ``User`` — admins are not
  shop owners. Both auth paths (Telegram and login/password) ultimately
  resolve to the same ``PlatformAdmin`` row.
* ``AccessAttempt`` is an append-only audit log: every successful and
  failed login is recorded so the admin can see who tried to enter.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class AttemptSource(StrEnum):
    """Where the login attempt originated."""

    TELEGRAM = "telegram"          # /api/v1/auth/telegram (perekupchik)
    LOGIN = "login"                # /api/v1/auth/login    (perekupchik)
    ADMIN_TELEGRAM = "admin_telegram"  # /api/v1/admin/auth/telegram
    ADMIN_LOGIN = "admin_login"    # /api/v1/admin/auth/login
    BOT_START = "bot_start"        # Telegram bot /start command


class PlatformAdmin(Base):
    __tablename__ = "platform_admins"

    id: Mapped[int] = mapped_column(primary_key=True)

    # At least one of (tg_id, login) must be set — enforced by the service.
    tg_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    tg_username: Mapped[str | None] = mapped_column(String(64), nullable=True)

    login: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(120), nullable=True)

    full_name: Mapped[str] = mapped_column(String(120), nullable=False)

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )


class AccessAttempt(Base):
    """Append-only log of every login attempt — both success and failure."""

    __tablename__ = "access_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)

    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    source: Mapped[str] = mapped_column(String(20), nullable=False)
    """One of ``AttemptSource`` values."""

    identifier: Mapped[str] = mapped_column(String(120), nullable=False)
    """Telegram id (as string) or login that was used in the attempt."""

    tg_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    """Human-readable failure reason (e.g. ``"unknown tg_id"``); NULL on success."""

    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    """Resolved user/admin id when the identifier matched a known account."""

    __table_args__ = (
        Index("ix_access_attempts_source_time", "source", "attempted_at"),
        Index("ix_access_attempts_identifier", "identifier"),
        Index("ix_access_attempts_success_time", "success", "attempted_at"),
    )
