"""Admin-эндпоинты системы бэкапа (все под CurrentAdmin)."""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.core.deps import DbSession
from app.features.admin.auth import CurrentAdmin
from app.features.backup import repository as repo
from app.features.backup import service
from app.features.backup.models import BackupRun, BackupTrigger
from app.features.backup.schemas import ConfigIn, ConfigOut, RunOut

router = APIRouter(prefix="/admin/backup", tags=["backup"])


@router.get("/config", response_model=ConfigOut)
async def get_config(db: DbSession, admin: CurrentAdmin):
    return await repo.get_or_create_config(db)


@router.put("/config", response_model=ConfigOut)
async def put_config(payload: ConfigIn, request: Request, db: DbSession, admin: CurrentAdmin):
    cfg = await repo.get_or_create_config(db)
    for field, value in payload.model_dump().items():
        setattr(cfg, field, value)
    await db.commit()
    # перенастроить расписание, если scheduler уже поднят (lifespan)
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler is not None:
        from bot.scheduler import apply_backup_schedule

        apply_backup_schedule(scheduler, cfg)
    return cfg


@router.get("/runs", response_model=list[RunOut])
async def list_runs(db: DbSession, admin: CurrentAdmin):
    return await repo.list_runs(db)


@router.post("/run", response_model=RunOut)
async def run_now(db: DbSession, admin: CurrentAdmin):
    return await service.create_backup(db, trigger=BackupTrigger.manual)


@router.get("/runs/{run_id}/download")
async def download(run_id: int, db: DbSession, admin: CurrentAdmin):
    run = await db.get(BackupRun, run_id)
    if run is None or not run.filename:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    path = Path(get_settings().backup_dir) / run.filename
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "archive missing on disk")
    return FileResponse(path, filename=run.filename, media_type="application/gzip")


@router.post("/runs/{run_id}/send-telegram", response_model=RunOut)
async def send_telegram(run_id: int, request: Request, db: DbSession, admin: CurrentAdmin):
    run = await db.get(BackupRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    bot = getattr(request.app.state, "bot", None)
    if bot is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "bot unavailable")
    await service.deliver_to_tg(db, run, bot)
    return run


@router.post("/restore", response_model=RunOut | None)
async def restore(file: UploadFile, db: DbSession, admin: CurrentAdmin, force: bool = False):
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)
    try:
        try:
            await service.restore_backup(db, tmp_path, force=force)
        except service.RevisionMismatch as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)
    return None
