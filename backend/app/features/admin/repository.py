"""Database queries for ``platform_admins`` and ``access_attempts``."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.admin.models import AccessAttempt, PlatformAdmin


# ─── PlatformAdmin ─────────────────────────────────────────────────────


async def get_admin_by_id(
    db: AsyncSession, admin_id: int
) -> PlatformAdmin | None:
    return await db.get(PlatformAdmin, admin_id)


async def get_admin_by_tg_id(
    db: AsyncSession, tg_id: int
) -> PlatformAdmin | None:
    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.tg_id == tg_id)
    )
    return result.scalar_one_or_none()


async def get_admin_by_login(
    db: AsyncSession, login: str
) -> PlatformAdmin | None:
    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.login == login)
    )
    return result.scalar_one_or_none()


async def count_admins(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(PlatformAdmin.id)))
    return int(result.scalar_one())


async def add_admin(db: AsyncSession, admin: PlatformAdmin) -> PlatformAdmin:
    db.add(admin)
    await db.flush()
    return admin


# ─── AccessAttempt (append-only) ───────────────────────────────────────


async def add_attempt(db: AsyncSession, attempt: AccessAttempt) -> AccessAttempt:
    db.add(attempt)
    await db.flush()
    return attempt


async def search_attempts(
    db: AsyncSession,
    *,
    source: str | None,
    success: bool | None,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> tuple[list[AccessAttempt], int]:
    base = select(AccessAttempt)
    if source:
        base = base.where(AccessAttempt.source == source)
    if success is not None:
        base = base.where(AccessAttempt.success == success)
    if date_from is not None:
        base = base.where(func.date(AccessAttempt.attempted_at) >= date_from)
    if date_to is not None:
        base = base.where(func.date(AccessAttempt.attempted_at) <= date_to)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    items = (
        await db.execute(
            base.order_by(AccessAttempt.attempted_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return list(items), int(total)
