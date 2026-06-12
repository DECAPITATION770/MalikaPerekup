import pytest

from app.features.backup import repository as repo
from app.features.backup.models import BackupStatus, BackupTrigger


@pytest.mark.asyncio
async def test_get_config_creates_singleton(db):
    cfg1 = await repo.get_or_create_config(db)
    cfg2 = await repo.get_or_create_config(db)
    assert cfg1.id == 1
    assert cfg2.id == 1
    assert cfg1.retention_count == 7  # default


@pytest.mark.asyncio
async def test_prune_keeps_latest_n(db):
    for _ in range(5):
        await repo.create_run(db, trigger=BackupTrigger.manual)
    runs = await repo.list_runs(db)
    assert len(runs) == 5
    removed = await repo.runs_beyond_retention(db, keep=3)
    assert len(removed) == 2
    # старейшие два
    assert removed[0].id < removed[1].id < runs[0].id
