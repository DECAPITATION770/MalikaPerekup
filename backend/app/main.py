"""FastAPI application entrypoint.

The lifespan hook owns the bot, the scheduler, and the channel registry —
they all start when the API starts and stop when it stops. If the bot is
ever extracted into its own process, only this file changes.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.storage import ensure_bucket
from app.core.config import get_settings
from app.core.database import SessionFactory
from app.core.logging import configure_logging, logger
from app.core.metrics import setup_metrics
from app.core.sentry import init_sentry
from app.features.admin import service as admin_service
from app.features.exchange import service as exchange_service
from app.features.admin.router import router as admin_router
from app.features.attachments.router import router as attachments_router
from app.features.auth.router import router as auth_router
from app.features.catalog.router import router as catalog_router
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

# Observability — set up before anything else so subsequent imports use the
# configured logger and Sentry catches startup failures.
configure_logging()
init_sentry()

settings = get_settings()


async def _verify_migrations(db) -> None:
    """Warn loudly (and fail in prod) if the DB schema isn't at head.

    Chaos-test finding #1: a deployed model change whose migration wasn't
    applied turned every INSERT into a 500. This catches that at boot.
    """
    from pathlib import Path

    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import text

    try:
        cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        head = ScriptDirectory.from_config(cfg).get_current_head()
        current = (
            await db.execute(text("SELECT version_num FROM alembic_version"))
        ).scalar_one_or_none()
    except Exception as exc:  # noqa: BLE001 — never block boot on the check itself
        logger.warning("migrations.check_failed", error=str(exc))
        return

    if current != head:
        logger.warning("migrations.out_of_date", current=current, head=head)
        if settings.is_prod:
            raise RuntimeError(
                f"DB schema out of date: at {current}, expected {head}. "
                "Run `alembic upgrade head`."
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start bot polling, scheduler, channel registry, bootstrap admins."""
    # 0. Fail fast if the schema isn't migrated to head.
    async with SessionFactory() as db:
        await _verify_migrations(db)

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

    # 1b. Ensure the object-storage bucket exists — photo/file uploads PUT
    #     straight into it via presigned URLs, so a missing bucket means every
    #     upload 404s. Best-effort: R2 buckets are pre-provisioned and MinIO may
    #     be briefly unreachable; neither should block API boot.
    try:
        ensure_bucket()
    except Exception as exc:  # noqa: BLE001
        logger.warning("storage.ensure_bucket_failed", error=str(exc))

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
    # Routes are declared without a trailing slash; a stray "/" from an
    # integration would otherwise 307-redirect and trigger a second CORS
    # preflight in the browser. 404 is the more predictable contract.
    redirect_slashes=False,
)

# Prometheus /internal/metrics — must be attached BEFORE the routers below
# so the instrumentator sees them.
setup_metrics(app)

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
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(devices_router, prefix="/api/v1")
app.include_router(purchases_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(installments_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(attachments_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Liveness probe used by Docker and the reverse proxy."""
    logger.debug("health.ping")
    return {"status": "ok"}
