"""Telegram channel — thin wrapper over ``aiogram.Bot.send_message``.

Aiogram is used purely as the HTTP client for the Bot API here. None of
the bot's command handlers know this exists; conversely, this module
knows nothing about handlers — they're orthogonal concerns.
"""

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter

from app.features.auth.models import User
from app.features.notifications.channels.base import Channel, ChannelError
from app.features.notifications.models import Notification


class TelegramChannel(Channel):
    code = "telegram"

    def __init__(self, bot: Bot) -> None:
        self._bot = bot

    async def send(
        self, notification: Notification, user: User, text: str
    ) -> None:
        if user.tg_id is None:
            raise ChannelError("user has no Telegram chat id")
        try:
            await self._bot.send_message(
                chat_id=user.tg_id,
                text=text,
                # Plain text is safer than Markdown — no escape headaches.
                parse_mode=None,
                disable_web_page_preview=True,
            )
        except TelegramForbiddenError as exc:
            # User blocked the bot — permanent, do not retry.
            raise ChannelError(f"telegram forbidden: {exc}") from exc
        except TelegramRetryAfter as exc:
            # Flood limit hit — re-raise so the dispatcher retries later.
            raise ChannelError(f"telegram rate limited (retry in {exc.retry_after}s)") from exc
        except Exception as exc:  # noqa: BLE001
            # Network errors and other transient failures.
            raise ChannelError(f"telegram send failed: {exc}") from exc
