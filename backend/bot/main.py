"""Bot lifecycle wiring.

The bot has two responsibilities and nothing more:
* greet new users and hand them a button into the Mini App;
* be the *transport* through which the notifications service sends pushes.

It is started and stopped from FastAPI's ``lifespan`` (see ``app.main``)
so the whole stack lives in one process. If the bot is later split into
its own process, only the imports here need to move.
"""

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from app.core.config import get_settings
from bot.handlers import start as start_handler


def build_bot() -> Bot:
    """Construct the singleton ``Bot`` used by handlers and the dispatcher."""
    return Bot(
        token=get_settings().bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def build_dispatcher() -> Dispatcher:
    """Build the message dispatcher with our handlers."""
    dp = Dispatcher()
    dp.include_router(start_handler.router)
    return dp
