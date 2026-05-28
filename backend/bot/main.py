"""Aiogram bot — minimum viable: /start sends a WebApp keyboard button.

Run with:  cd backend && uv run python -m bot.main
Requires BOT_TOKEN and WEBAPP_URL set in repo-root .env.
"""

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import (
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("bot")

dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="🛒 Открыть Malika",
                    web_app=WebAppInfo(url=settings.webapp_url),
                )
            ]
        ],
        resize_keyboard=True,
    )
    await message.answer(
        "Привет! Это Malika v2 (skeleton). Жми кнопку ниже, чтобы открыть приложение.",
        reply_markup=kb,
    )


async def main() -> None:
    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN not set in .env")
    if not settings.webapp_url:
        raise RuntimeError("WEBAPP_URL not set in .env — set to your ngrok HTTPS URL")
    if not settings.webapp_url.startswith("https://"):
        raise RuntimeError("WEBAPP_URL must be HTTPS — Telegram requires it for WebApp buttons")

    bot = Bot(token=settings.bot_token)
    logger.info("Bot starting. WebApp URL: %s", settings.webapp_url)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
