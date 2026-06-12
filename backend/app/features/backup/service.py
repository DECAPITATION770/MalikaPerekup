"""Ядро бэкапа: создание архива, восстановление, ретеншн, доставка в TG."""

from __future__ import annotations

import asyncio
import json
import tarfile
import tempfile
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.core.config import get_settings
from app.features.backup import repository as repo
from app.features.backup import storage_ops
from app.features.backup.models import BackupRun, BackupStatus, BackupTrigger

APP_VERSION = "1.0.0"  # при наличии — взять из единого источника версии


class RevisionMismatch(RuntimeError):
    pass


async def _alembic_revision(db: AsyncSession) -> str | None:
    """Текущая ревизия Alembic, или None если таблицы ещё нет.

    В тестах схема собирается через ``Base.metadata.create_all`` — таблицы
    ``alembic_version`` там нет, поэтому отсутствие трактуем как "ревизия
    неизвестна", а не как ошибку бэкапа.
    """
    try:
        row = await db.execute(text("SELECT version_num FROM alembic_version"))
    except Exception:
        await db.rollback()
        return None
    val = row.scalar_one_or_none()
    return str(val) if val is not None else None


async def _run_subprocess(*args: str, env: dict | None = None) -> None:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"{args[0]} exited {proc.returncode}: "
            f"{stderr.decode(errors='replace')[:500]}"
        )


def _pg_url(async_url: str) -> str:
    # pg_dump хочет обычный URL без +asyncpg
    return async_url.replace("+asyncpg", "")


async def create_backup(db: AsyncSession, *, trigger: BackupTrigger) -> BackupRun:
    settings = get_settings()
    run = await repo.create_run(db, trigger=trigger)
    await db.commit()

    ts = now_utc().strftime("%Y%m%d-%H%M%S")
    filename = f"malika-backup-{ts}.tar.gz"
    out_dir = Path(settings.backup_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    archive_path = out_dir / filename

    try:
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            dump_path = work / "database.dump"
            await _run_subprocess(
                "pg_dump", "-Fc", _pg_url(str(settings.database_url)),
                "-f", str(dump_path),
            )
            objects_dir = work / "objects"
            objects_dir.mkdir()
            object_count = storage_ops.download_all(objects_dir)
            revision = await _alembic_revision(db)
            manifest = {
                "backup_id": run.id,
                "created_at": ts,
                "app_version": APP_VERSION,
                "alembic_revision": revision,
                "db_name": str(settings.database_url).rsplit("/", 1)[-1],
                "object_count": object_count,
                "bucket": settings.s3_bucket,
            }
            (work / "manifest.json").write_text(json.dumps(manifest, indent=2))

            with tarfile.open(archive_path, "w:gz") as tar:
                tar.add(dump_path, arcname="database.dump")
                tar.add(work / "manifest.json", arcname="manifest.json")
                tar.add(objects_dir, arcname="objects")

        run.status = BackupStatus.ok
        run.filename = filename
        run.size_bytes = archive_path.stat().st_size
        run.object_count = object_count
        run.alembic_revision = revision
        await db.commit()
    except Exception as exc:  # noqa: BLE001 — записываем причину и выходим
        run.status = BackupStatus.failed
        run.error = str(exc)[:1000]
        await db.commit()
        if archive_path.exists():
            archive_path.unlink(missing_ok=True)
        raise

    await prune(db)
    return run


async def prune(db: AsyncSession) -> None:
    cfg = await repo.get_or_create_config(db)
    settings = get_settings()
    for old in await repo.runs_beyond_retention(db, keep=cfg.retention_count):
        if old.filename:
            (Path(settings.backup_dir) / old.filename).unlink(missing_ok=True)
        await db.delete(old)
    await db.commit()
