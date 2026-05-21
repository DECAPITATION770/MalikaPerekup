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


# Tables in dependency order (children first), used by the per-test cleanup.
_TABLES_TO_TRUNCATE = (
    "cbu_rate_cache",
    "notifications",
    "access_attempts",
    "installment_payments",
    "installment_plans",
    "sales",
    "purchases",
    "devices",
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
