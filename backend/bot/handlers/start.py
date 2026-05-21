"""``/start`` handler — the only command the bot owns.

Closed-platform behaviour:
* known ``tg_id`` (registered by the platform admin) → show the WebApp button;
* unknown ``tg_id`` → polite refusal + entry in ``access_attempts`` so the
  admin can see who tried to enter.
"""

from aiogram import Router, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from app.core.config import get_settings
from app.core.database import SessionFactory
from app.features.admin import repository as admin_repo
from app.features.admin import service as admin_service
from app.features.admin.models import AttemptSource
from app.features.auth import repository as user_repo

router = Router(name="start")


@router.message(CommandStart())
async def handle_start(message: types.Message) -> None:
    settings = get_settings()
    tg_id = message.from_user.id if message.from_user else None
    tg_username = message.from_user.username if message.from_user else None

    async with SessionFactory() as db:
        # Allow platform admins through too — they may want to test the WebApp.
        admin = (
            await admin_repo.get_admin_by_tg_id(db, tg_id) if tg_id else None
        )
        user = (
            await user_repo.get_by_tg_id(db, tg_id) if tg_id else None
        )

        if admin is None and user is None:
            await admin_service.log_attempt(
                db,
                source=AttemptSource.BOT_START,
                identifier=str(tg_id) if tg_id else "?",
                tg_username=tg_username,
                success=False,
                reason="unknown tg_id",
            )
            await db.commit()
            await message.answer(
                "🚫 Доступ запрещён.\n"
                "Свяжитесь с администратором для регистрации.\n\n"
                "🚫 Ruxsat yo'q.\n"
                "Ro'yxatdan o'tish uchun administrator bilan bog'laning."
            )
            return

        await admin_service.log_attempt(
            db,
            source=AttemptSource.BOT_START,
            identifier=str(tg_id),
            tg_username=tg_username,
            success=True,
            user_id=admin.id if admin else (user.id if user else None),
        )
        await db.commit()

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📱 Открыть приложение",
                    web_app=WebAppInfo(url=settings.bot_webapp_url),
                )
            ]
        ]
    )
    await message.answer(
        "Salom! / Здравствуйте!\n\n"
        "Это бот учёта Malika Perekup.\n"
        "Откройте приложение, чтобы начать работу.",
        reply_markup=keyboard,
    )
