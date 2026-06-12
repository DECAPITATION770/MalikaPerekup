from datetime import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.features.backup.models import BackupConfig, BackupFrequency
from bot.scheduler import apply_backup_schedule


def test_disabled_removes_job():
    sched = AsyncIOScheduler()
    cfg = BackupConfig(id=1, enabled=False, frequency=BackupFrequency.off,
                       retention_count=7)
    apply_backup_schedule(sched, cfg)
    assert sched.get_job("backup") is None


def test_daily_registers_cron_job():
    sched = AsyncIOScheduler()
    cfg = BackupConfig(id=1, enabled=True, frequency=BackupFrequency.daily,
                       daily_time=time(3, 0), retention_count=7)
    apply_backup_schedule(sched, cfg)
    assert sched.get_job("backup") is not None
