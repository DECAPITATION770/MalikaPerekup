import tarfile
import tempfile
from pathlib import Path

import pytest

from app.common import storage
from app.features.backup import service, storage_ops
from app.features.backup.models import BackupStatus, BackupTrigger


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
