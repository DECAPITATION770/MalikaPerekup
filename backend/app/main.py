"""FastAPI application entrypoint.

The lifespan hook owns the bot, the scheduler, and the channel registry —
they all start when the API starts and stop when it stops. If the bot is
ever extracted into its own process, only this file changes.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import SessionFactory
from app.features.admin import service as admin_service
from app.features.exchange import service as exchange_service
from app.features.admin.router import router as admin_router
from app.features.auth.router import router as auth_router
from app.features.counterparties.router import router as counterparties_router
from app.features.devices.router import router as devices_router
from app.features.installments.router import router as installments_router
from app.features.notifications import service as notify_service
from app.features.notifications.channels.telegram import TelegramChannel
from app.features.purchases.router import router as purchases_router
from app.features.reports.router import router as reports_router
from app.features.sales.router import router as sales_router
from app.features.shops.router import router as shops_router
from bot.main import build_bot, build_dispatcher
from bot.scheduler import build_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start bot polling, scheduler, channel registry, bootstrap admins."""
    # 1. Seed first admins from env (no-op if any admin already exists).
    async with SessionFactory() as db:
        await admin_service.bootstrap_admins_if_needed(
            db,
            tg_ids=settings.bootstrap_admin_ids,
            login=settings.bootstrap_admin_login,
            password=settings.bootstrap_admin_password,
            name=settings.bootstrap_admin_name,
        )
        await db.commit()

    bot = build_bot()
    dispatcher = build_dispatcher()
    scheduler = build_scheduler()

    notify_service.register_channel(TelegramChannel(bot))

    polling_task = asyncio.create_task(
        dispatcher.start_polling(bot, handle_signals=False)
    )
    scheduler.start()

    async def _startup_cbu_refresh() -> None:
        try:
            async with SessionFactory() as db:
                await exchange_service.refresh_cbu_rate(db)
                await db.commit()
        except Exception:
            pass

    asyncio.create_task(_startup_cbu_refresh())

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        await dispatcher.stop_polling()
        polling_task.cancel()
        await bot.session.close()


app = FastAPI(
    title="Malika Perekup API",
    version="0.1.0",
    docs_url="/docs" if not settings.is_prod else None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS is wide open for now because the Mini App is served from a separate
# origin (BOT_WEBAPP_URL) inside Telegram WebView. Tighten in stage 12.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ──────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(shops_router, prefix="/api/v1")
app.include_router(counterparties_router, prefix="/api/v1")
app.include_router(devices_router, prefix="/api/v1")
app.include_router(purchases_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(installments_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Liveness probe used by Docker and the reverse proxy."""
    return {"status": "ok"}
