"""Deliver a generated report file to the user's Telegram chat.

Telegram's in-app WebView blocks blob/``<a download>`` downloads, so inside
the Mini App the export button asks the backend to push the ``.xlsx`` to the
user as a bot document instead of returning it for the browser to save.
"""

from aiogram import Bot
from aiogram.types import BufferedInputFile

from app.features.auth.models import User


class ReportDeliveryError(Exception):
    """Raised when the report cannot be delivered via Telegram."""


async def send_xlsx(
    bot: Bot, user: User, *, content: bytes, filename: str, caption: str
) -> None:
    """Send ``content`` as an ``.xlsx`` document to the user's Telegram chat.

    Mirrors the notifications channel's chat-id resolution: an owner can
    redirect delivery to a shared chat via ``notify_tg_chat_id``; otherwise
    it goes to their own DM (``tg_id``).
    """
    chat_id = user.notify_tg_chat_id or user.tg_id
    if chat_id is None:
        raise ReportDeliveryError("user has no Telegram chat id")
    await bot.send_document(
        chat_id,
        BufferedInputFile(content, filename=filename),
        caption=caption,
    )
