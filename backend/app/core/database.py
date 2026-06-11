"""Async SQLAlchemy engine, session factory, and ORM declarative base.

A single engine is created at import time and reused across the whole app.
``get_db`` is the FastAPI dependency that yields a request-scoped session
and commits on success / rolls back on error.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

_settings = get_settings()

# ``pool_pre_ping`` checks the connection is alive before handing it out —
# avoids stale-connection errors when PostgreSQL closes idle sockets.
# `echo` dumps every SQL statement WITH bound parameters to stdout — that
# includes PII (phones, doc numbers). Force it off in prod regardless of
# DEBUG so the env-var setting can't silently leak data.
engine = create_async_engine(
    str(_settings.database_url),
    echo=False if _settings.is_prod else _settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # ORM objects stay usable after commit.
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for every ORM model in the project."""


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a database session for the duration of one HTTP request.

    Commits on success, rolls back on any exception, always closes.
    """
    async with SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
