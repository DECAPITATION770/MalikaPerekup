"""Alembic migration environment, async-aware.

Reads the database URL from ``app.core.config`` so it always matches the
running application. Each feature module's ``models.py`` will be imported
below as it is added — Alembic uses ``Base.metadata`` to autogenerate
migrations, so models must be imported before ``run_migrations`` is called.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.core.database import Base

# Feature model imports — uncomment as each stage adds them so Alembic sees
# the metadata when generating revisions.
from app.features.auth.models import User  # noqa: F401  (stage 3)
from app.features.shops.models import Shop  # noqa: F401  (stage 4)
from app.features.counterparties.models import Counterparty  # noqa: F401  (stage 5)
from app.features.devices.models import Device  # noqa: F401  (stage 6)
from app.features.purchases.models import Purchase  # noqa: F401  (stage 7)
from app.features.sales.models import Sale  # noqa: F401  (stage 8)
from app.features.installments.models import (  # noqa: F401  (stage 9)
    InstallmentPayment,
    InstallmentPlan,
)
from app.features.notifications.models import Notification  # noqa: F401  (stage 11)
from app.features.admin.models import (  # noqa: F401  (stage 13)
    AccessAttempt,
    PlatformAdmin,
)
from app.features.exchange.models import CbuRateCache  # noqa: F401  (stage 12)

# from app.features.devices.models import *        # noqa: F401, F403  (stage 6)
# from app.features.purchases.models import *      # noqa: F401, F403  (stage 7)
# from app.features.sales.models import *          # noqa: F401, F403  (stage 8)
# from app.features.installments.models import *   # noqa: F401, F403  (stage 9)
# from app.features.notifications.models import *  # noqa: F401, F403  (stage 11)

config = context.config
config.set_main_option("sqlalchemy.url", str(get_settings().database_url))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Generate SQL without connecting to the database."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Apply migrations against a live async database."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_run_sync)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
