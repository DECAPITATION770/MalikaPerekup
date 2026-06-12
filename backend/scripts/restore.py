"""CLI: uv run python -m scripts.restore <archive.tar.gz> [--yes] [--force]"""

import asyncio
import sys
from pathlib import Path

from app.core.database import SessionFactory
from app.features.backup import service


async def _main(archive: str, force: bool) -> None:
    async with SessionFactory() as db:
        await service.restore_backup(db, Path(archive), force=force)
        print("OK: restore complete")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or "--yes" not in args:
        print("ОПАСНО: restore затрёт текущую БД и бакет. "
              "Добавь --yes для подтверждения.")
        raise SystemExit(1)
    archive = next(a for a in args if not a.startswith("--"))
    asyncio.run(_main(archive, force="--force" in args))
