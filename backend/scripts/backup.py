"""CLI: uv run python -m scripts.backup"""

import asyncio

from app.core.database import SessionFactory
from app.features.backup import service
from app.features.backup.models import BackupTrigger


async def _main() -> None:
    async with SessionFactory() as db:
        run = await service.create_backup(db, trigger=BackupTrigger.manual)
        print(f"OK: backup #{run.id} -> {run.filename} ({run.size_bytes} bytes)")


if __name__ == "__main__":
    asyncio.run(_main())
