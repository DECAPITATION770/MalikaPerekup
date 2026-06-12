"""Shared pytest fixtures.

Tests run against a real PostgreSQL instance (the ``malika_test`` database
on port 5433 from ``infra/docker-compose.yml``). No SQLite mocking — the
production engine is asyncpg, and we want the same query semantics in tests.

Fixture strategy:
* **session-scoped schema setup** — drops and recreates the public schema
  exactly once via a throwaway engine, then disposes it;
* **function-scoped engine + db** — a fresh engine per test guarantees that
  every connection lives in the same asyncio loop as the test that uses it
  (asyncpg connections cannot cross event loops).

Usage from CLI::

    docker compose --profile test up -d postgres_test
    cd backend && uv run pytest
"""

import os
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Configure environment BEFORE importing app modules.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://malika:malika@localhost:5433/malika_test",
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("S3_ENDPOINT", "localhost:9000")
os.environ.setdefault("S3_ACCESS_KEY", "minioadmin")
os.environ.setdefault("S3_SECRET_KEY", "minioadmin")
os.environ.setdefault("S3_BUCKET", "malika-test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("BOT_TOKEN", "0:test-token")
os.environ.setdefault("BOT_WEBAPP_URL", "https://test.example.com")
os.environ.setdefault("DEV_AUTH_BYPASS", "true")
os.environ.setdefault("DEV_BYPASS_USER_ID", "1")

from app.core.config import get_settings  # noqa: E402
from app.core.database import Base  # noqa: E402

# Import every model so ``Base.metadata`` knows about all tables.
from app.features.auth.models import User  # noqa: F401, E402
from app.features.catalog.models import CatalogModel  # noqa: F401, E402
from app.features.counterparties.models import Counterparty  # noqa: F401, E402
from app.features.devices.models import Device  # noqa: F401, E402
from app.features.installments.models import (  # noqa: F401, E402
    InstallmentPayment,
    InstallmentPlan,
)
from app.features.notifications.models import Notification  # noqa: F401, E402
from app.features.purchases.models import Purchase  # noqa: F401, E402
from app.features.sales.models import Sale  # noqa: F401, E402
from app.features.shops.models import Shop  # noqa: F401, E402
from app.features.admin.models import (  # noqa: F401, E402
    AccessAttempt,
    PlatformAdmin,
)
from app.features.exchange.models import CbuRateCache  # noqa: F401, E402
from app.features.backup.models import (  # noqa: F401, E402
    BackupConfig,
    BackupRun,
)


# Tables in dependency order (children first), used by the per-test cleanup.
_TABLES_TO_TRUNCATE = (
    "backup_runs",
    "backup_config",
    "cbu_rate_cache",
    "notifications",
    "access_attempts",
    "installment_payments",
    "installment_plans",
    "sales",
    "purchases",
    "devices",
    "catalog_models",
    "counterparties",
    "users",
    "shops",
    "platform_admins",
)


_SCHEMA_READY = False


async def _ensure_schema(db_url: str) -> None:
    """Build the schema once per process. Subsequent calls are no-ops.

    Uses a throwaway engine so no pooled connections leak across event loops.
    """
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return
    engine = create_async_engine(db_url, echo=False)
    try:
        async with engine.begin() as conn:
            # Cyclic FK between users and shops defeats ``Base.metadata.drop_all``.
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.run_sync(Base.metadata.create_all)
    finally:
        await engine.dispose()
    _SCHEMA_READY = True


@pytest_asyncio.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    """A fresh engine per test — guarantees one event loop per connection."""
    db_url = str(get_settings().database_url)
    await _ensure_schema(db_url)

    engine = create_async_engine(db_url, echo=False)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """A session per test, plus a TRUNCATE pass afterwards."""
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        try:
            yield session
        finally:
            await session.rollback()

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE "
                + ", ".join(_TABLES_TO_TRUNCATE)
                + " RESTART IDENTITY CASCADE"
            )
        )


@pytest_asyncio.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """ASGI test client wired to a real DB — no mocked dependencies."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    """ASGI client carrying a valid platform-admin JWT.

    Creates a PlatformAdmin row (committed, so the app's own session sees it),
    mints an admin token, and attaches it as a Bearer header. Cleans up the
    row afterwards since tests using this fixture don't depend on ``db`` (whose
    teardown is what normally truncates).
    """
    from app.features.admin.auth import create_admin_token
    from app.features.admin.models import PlatformAdmin
    from app.main import app

    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        admin = PlatformAdmin(tg_id=990001, full_name="Test Admin")
        session.add(admin)
        await session.commit()
        token = create_admin_token(admin.id)

    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        ) as ac:
            yield ac
    finally:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "TRUNCATE TABLE backup_runs, backup_config, platform_admins "
                    "RESTART IDENTITY CASCADE"
                )
            )
