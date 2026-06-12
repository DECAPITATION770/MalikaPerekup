import tempfile
from pathlib import Path

import pytest

from app.common import storage
from app.features.backup import storage_ops


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
