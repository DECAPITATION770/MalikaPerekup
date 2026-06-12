"""Доступ к данным бэкапа: синглтон-конфиг и история запусков."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.backup.models import (
    BackupConfig,
    BackupRun,
    BackupStatus,
    BackupTrigger,
)


async def get_or_create_config(db: AsyncSession) -> BackupConfig:
    cfg = await db.get(BackupConfig, 1)
    if cfg is None:
        cfg = BackupConfig(id=1)
        db.add(cfg)
        await db.flush()
    return cfg


async def create_run(db: AsyncSession, *, trigger: BackupTrigger) -> BackupRun:
    run = BackupRun(status=BackupStatus.running, trigger=trigger)
    db.add(run)
    await db.flush()
    return run


async def list_runs(db: AsyncSession, *, limit: int = 100) -> list[BackupRun]:
    rows = await db.execute(
        select(BackupRun).order_by(BackupRun.id.desc()).limit(limit)
    )
    return list(rows.scalars().all())


async def runs_beyond_retention(db: AsyncSession, *, keep: int) -> list[BackupRun]:
    """Run'ы за пределами последних ``keep`` (для удаления), старейшие первыми.

    Ретеншн считает все запуски (без фильтра по статусу) — это ровно то
    поведение, что закодировано в ``test_prune_keeps_latest_n``: оставляем
    ``keep`` самых свежих run'ов, остальное возвращаем по возрастанию id,
    чтобы вызывающий удалил сначала самые старые.
    """
    keep_ids = (
        await db.execute(
            select(BackupRun.id).order_by(BackupRun.id.desc()).limit(keep)
        )
    ).scalars().all()
    stmt = select(BackupRun).order_by(BackupRun.id.asc())
    if keep_ids:
        stmt = stmt.where(BackupRun.id.notin_(keep_ids))
    rows = await db.execute(stmt)
    return list(rows.scalars().all())
