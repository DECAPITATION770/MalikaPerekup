"""User ORM model.

One ``users`` row represents one human regardless of how they log in:
* Telegram Mini App (``tg_id`` set when they /start the bot)
* Login + password fallback (``login`` + ``password_hash`` set in Settings)

Both paths issue the same JWT for the same ``id``, so feature code never
needs to know which method was used.
"""

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # ── Telegram identity (primary auth path) ──
    tg_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    tg_username: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Profile ──
    full_name: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(2), default="ru", server_default="ru")
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # ── Password fallback (set in Settings → Security) ──
    login: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # ── Shop membership ──
    # Nullable because a user exists for a brief moment between Telegram auth
    # and the onboarding ``POST /shops`` call. Every business endpoint relies
    # on this column being set; ``get_current_shop`` returns 403 otherwise.
    shop_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=True, index=True
    )

    # ── Notification preferences ──
    # List of channel codes through which the user wants reminders.
    # MVP supports ``"telegram"`` only; add ``"sms"`` / ``"push"`` later
    # without touching the dispatcher.
    notification_channels: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=lambda: ["telegram"], server_default='["telegram"]'
    )

    # Optional override for *where* Telegram notifications land. NULL means
    # "send to the same chat the user logs in from" (``tg_id``). Set this to a
    # group/channel chat id when the owner wants reminders in a separate chat
    # (e.g. a shared shop group) instead of their personal DM with the bot.
    notify_tg_chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # ── Login bookkeeping (visible to platform admin) ──
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    """``telegram`` or ``login`` — last successful auth path."""

    # ── Blocking (platform admin) ──
    # Soft block of the Telegram/initData surface only — login/password still
    # works. Enforced in get_current_user for telegram-src sessions.
    is_blocked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    blocked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Telegram avatar (fetched on login, cached in object storage) ──
    avatar_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Admin-maintained contact note (works for non-Telegram tenants) ──
    admin_contact_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    @property
    def has_password(self) -> bool:
        """True when the user configured the password fallback."""
        return self.password_hash is not None
