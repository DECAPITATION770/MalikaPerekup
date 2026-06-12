import shutil
import tarfile
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import text as sql_text

from app.common import storage
from app.features.backup import service, storage_ops
from app.features.backup.models import BackupStatus, BackupTrigger

# create/restore shell out to pg_dump/pg_restore. Skip when the client isn't
# installed (local dev macs) — CI and the backend image bundle it.
needs_pg_tools = pytest.mark.skipif(
    shutil.which("pg_dump") is None or shutil.which("pg_restore") is None,
    reason="pg_dump/pg_restore not installed",
)


@pytest.mark.asyncio
async def test_download_then_upload_objects():
    storage.ensure_bucket()
    key = "0/test/backup-fixture/hello.txt"
    storage.upload(key, b"hello-pii", "text/plain")

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "objects"
        count = storage_ops.download_all(dest)
        assert count >= 1
        assert (dest / key).read_bytes() == b"hello-pii"

        # удалить и восстановить
        storage.delete(key)
        storage_ops.upload_all(dest)

    # объект снова доступен
    data = storage._client().get_object(storage.get_settings().s3_bucket, key).read()
    assert data == b"hello-pii"


@needs_pg_tools
@pytest.mark.asyncio
async def test_create_backup_produces_archive(db, tmp_path, monkeypatch):
    monkeypatch.setattr(
        service.get_settings(), "backup_dir", str(tmp_path), raising=False
    )
    storage.ensure_bucket()
    storage.upload("0/test/run/doc.txt", b"passport", "text/plain")

    run = await service.create_backup(db, trigger=BackupTrigger.manual)
    assert run.status == BackupStatus.ok
    assert run.filename
    archive = tmp_path / run.filename
    assert archive.exists()
    with tarfile.open(archive, "r:gz") as tar:
        names = tar.getnames()
        assert any(n.endswith("database.dump") for n in names)
        assert any(n.endswith("manifest.json") for n in names)
        assert any("objects/" in n for n in names)


@needs_pg_tools
@pytest.mark.asyncio
async def test_restore_returns_data(db, tmp_path, monkeypatch):
    monkeypatch.setattr(
        service.get_settings(), "backup_dir", str(tmp_path), raising=False
    )
    storage.ensure_bucket()
    storage.upload("0/test/restore/a.txt", b"v1", "text/plain")

    # маркер в БД, который мы потом удалим и восстановим
    await db.execute(sql_text(
        "INSERT INTO backup_runs (created_at, status, trigger) "
        "VALUES (now(), 'ok', 'manual')"
    ))
    await db.commit()
    run = await service.create_backup(db, trigger=BackupTrigger.manual)
    archive = tmp_path / run.filename

    storage.delete("0/test/restore/a.txt")

    await service.restore_backup(db, archive)

    # объект вернулся
    data = storage._client().get_object(
        storage.get_settings().s3_bucket, "0/test/restore/a.txt"
    ).read()
    assert data == b"v1"
