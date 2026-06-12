# Backup System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный бэкап проекта (дамп Postgres + все файлы object storage) в один `.tar.gz` с восстановлением, расписанием, ретеншном, ручными операциями в админке и настраиваемой доставкой в Telegram.

**Architecture:** Новый backend-модуль `app/features/backup/` (models/repo/service/storage_ops/router). Ядро шеллит `pg_dump`/`pg_restore` по `DATABASE_URL` и тянет объекты через существующий `minio`-клиент. Расписание — в существующем APScheduler (`bot/scheduler.py`), доставка — через существующий `aiogram.Bot`. UI — новая страница `admin/src/pages/Backup.tsx`. Всё — только для platform-admin (`CurrentAdmin`).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, APScheduler, aiogram 3.x, `minio` client, pytest (реальный Postgres+MinIO), React 18 + Vite + TS (admin).

**Спецификация:** `docs/superpowers/specs/2026-06-12-backup-system-design.md` — читать перед началом.

**Запуск тестов backend (важно — отдельная тестовая БД):**
```bash
docker compose --profile test up -d postgres_test
docker compose up -d minio
cd backend && uv run pytest
# если порт 5433 занят: создать БД malika_test в malika_postgres и
# DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" uv run pytest
```

---

## File Structure

**Backend (создать):**
- `backend/app/features/backup/__init__.py`
- `backend/app/features/backup/models.py` — `BackupConfig`, `BackupRun`, enums
- `backend/app/features/backup/schemas.py` — Pydantic DTO
- `backend/app/features/backup/repository.py` — CRUD config (singleton) + runs
- `backend/app/features/backup/storage_ops.py` — list/download/upload объектов
- `backend/app/features/backup/service.py` — create/restore/deliver/prune
- `backend/app/features/backup/router.py` — admin-эндпоинты
- `backend/scripts/__init__.py` (если нет), `backend/scripts/backup.py`, `backend/scripts/restore.py`
- `backend/alembic/versions/0018_create_backup_tables.py`
- Тесты: `backend/tests/integration/test_backup_roundtrip.py`,
  `test_backup_retention.py`, `test_backup_split.py`, `test_backup_api.py`,
  `test_backup_schedule.py`

**Backend (модифицировать):**
- `backend/Dockerfile` — добавить `postgresql-client-16`
- `backend/bot/scheduler.py` — `apply_backup_schedule()` + регистрация на старте
- `backend/app/main.py` — `app.state.bot`/`app.state.scheduler`, include backup router
- `backend/app/core/config.py` — поле `backup_dir`

**Frontend admin (создать/модифицировать):**
- `admin/src/pages/Backup.tsx`, `admin/src/api/backup.ts`
- `admin/src/App.tsx` (+ роут), навигация, `admin/src/i18n/{ru,uz}.json` (`backup.*`)

**Инфра:**
- `docker-compose.yml`, `deploy/docker-compose.prod.yml` — volume `backup_data:/backups`
- `.env.example`, `deploy/.env.prod.example` — `BACKUP_DIR=/backups`
- `.gitignore` — `/backups/`
- `README.md` — раздел про бэкап/restore (вкл. сборку TG-частей через `cat`)

---

## Task 1: Инфраструктура — pg client, volume, config-поле

**Files:**
- Modify: `backend/Dockerfile` (runtime stage)
- Modify: `docker-compose.yml`, `deploy/docker-compose.prod.yml`
- Modify: `backend/app/core/config.py`
- Modify: `.env.example`, `.gitignore`

- [ ] **Step 1: Добавить postgresql-client-16 в runtime-образ**

В `backend/Dockerfile`, в **runtime stage** (после `WORKDIR /app`, до `USER app`):

```dockerfile
# pg_dump / pg_restore (версия 16 под сервер PG16) из официального PGDG repo
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg lsb-release \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Добавить volume для бэкапов в оба compose**

В `docker-compose.yml` сервис `backend` → добавить `volumes:` и в корневой
`volumes:` ключ `backup_data:`:

```yaml
  backend:
    # …существующее…
    volumes:
      - backup_data:/backups

volumes:
  postgres_data:
  redis_data:
  minio_data:
  backup_data:
```

Аналогично в `deploy/docker-compose.prod.yml` для сервиса `backend`.

- [ ] **Step 3: Поле backup_dir в Settings**

В `backend/app/core/config.py` в класс `Settings` добавить:

```python
    backup_dir: str = "/backups"
```

В `.env.example` добавить строку: `BACKUP_DIR=/backups`.
В `.gitignore` добавить: `/backups/` и `backups/`.

- [ ] **Step 4: Проверить сборку и валидность compose**

Run: `docker compose config --quiet && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile docker-compose.yml deploy/docker-compose.prod.yml backend/app/core/config.py .env.example .gitignore
git commit -m "chore(backup): pg_dump in image, /backups volume, backup_dir setting"
```

---

## Task 2: Модели и миграция

**Files:**
- Create: `backend/app/features/backup/__init__.py` (пустой)
- Create: `backend/app/features/backup/models.py`
- Create: `backend/alembic/versions/0018_create_backup_tables.py`
- Test: `backend/tests/integration/test_backup_roundtrip.py` (заготовка импорта)

- [ ] **Step 1: Написать модели**

`backend/app/features/backup/models.py`:

```python
"""ORM-модели для системы бэкапа (platform-level, без shop_id)."""

from __future__ import annotations

import enum
from datetime import datetime, time

from sqlalchemy import BigInteger, Boolean, Enum, Integer, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BackupFrequency(str, enum.Enum):
    off = "off"
    daily = "daily"
    interval = "interval"


class TgDeliveryMode(str, enum.Enum):
    full_if_fits = "full_if_fits"
    db_only = "db_only"
    split = "split"


class BackupStatus(str, enum.Enum):
    running = "running"
    ok = "ok"
    failed = "failed"


class BackupTrigger(str, enum.Enum):
    manual = "manual"
    auto = "auto"


class BackupConfig(Base):
    __tablename__ = "backup_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # singleton == 1
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    frequency: Mapped[BackupFrequency] = mapped_column(
        Enum(BackupFrequency, name="backup_frequency"),
        default=BackupFrequency.off,
        nullable=False,
    )
    daily_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    interval_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retention_count: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    tg_chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    tg_auto_send: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tg_delivery_mode: Mapped[TgDeliveryMode] = mapped_column(
        Enum(TgDeliveryMode, name="tg_delivery_mode"),
        default=TgDeliveryMode.full_if_fits,
        nullable=False,
    )
    tg_part_size_mb: Mapped[int] = mapped_column(Integer, default=49, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    status: Mapped[BackupStatus] = mapped_column(
        Enum(BackupStatus, name="backup_status"), nullable=False
    )
    trigger: Mapped[BackupTrigger] = mapped_column(
        Enum(BackupTrigger, name="backup_trigger"), nullable=False
    )
    filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    object_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alembic_revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_to_tg: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
```

> ⚠️ Проверь импорт `Base` — открой `backend/app/core/database.py` и подтверди
> имя declarative base (предположительно `Base`). Если другое — поправь импорт.

- [ ] **Step 2: Убедиться, что модель видна Alembic autogenerate**

Открой `backend/alembic/env.py`, найди где импортируются модели для `target_metadata`
(обычно `from app.features... import *` или явный список). Добавь импорт
`app.features.backup.models`, чтобы таблицы попали в metadata.

- [ ] **Step 3: Сгенерировать миграцию**

Run:
```bash
cd backend && uv run alembic revision --autogenerate -m "create backup tables"
```
Переименуй файл в `0018_create_backup_tables.py`, проверь `down_revision = "0017_add_user_notify_chat"` (точное имя ревизии 0017 — посмотри в шапке `0017_*.py`).

- [ ] **Step 4: Применить и проверить обратимость**

Run:
```bash
cd backend && uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head
```
Expected: без ошибок, таблицы `backup_config`/`backup_runs` создаются и удаляются.

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/backup/__init__.py backend/app/features/backup/models.py backend/alembic/versions/0018_create_backup_tables.py backend/alembic/env.py
git commit -m "feat(backup): models + migration for backup_config and backup_runs"
```

---

## Task 3: Repository (config-синглтон + runs)

**Files:**
- Create: `backend/app/features/backup/repository.py`
- Test: `backend/tests/integration/test_backup_retention.py`

- [ ] **Step 1: Написать failing-тест на get-or-create синглтона**

`backend/tests/integration/test_backup_retention.py`:

```python
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
```

> `db` — фикстура из `backend/tests/conftest.py` (AsyncSession). Подтверди имя
> фикстуры, открыв conftest (там же `client`).

- [ ] **Step 2: Запустить — упадёт (нет repository)**

Run: `cd backend && uv run pytest tests/integration/test_backup_retention.py -v`
Expected: FAIL (ModuleNotFoundError / AttributeError).

- [ ] **Step 3: Реализовать repository**

`backend/app/features/backup/repository.py`:

```python
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
    """Вернуть успешные run'ы старше последних `keep` (для удаления)."""
    rows = await db.execute(
        select(BackupRun)
        .where(BackupRun.status == BackupStatus.ok)
        .order_by(BackupRun.id.desc())
        .offset(keep)
    )
    return list(rows.scalars().all())
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `cd backend && uv run pytest tests/integration/test_backup_retention.py -v`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/backup/repository.py backend/tests/integration/test_backup_retention.py
git commit -m "feat(backup): repository for config singleton and runs + retention query"
```

---

## Task 4: storage_ops — выгрузка/заливка объектов бакета

**Files:**
- Create: `backend/app/features/backup/storage_ops.py`
- Test: `backend/tests/integration/test_backup_roundtrip.py`

- [ ] **Step 1: Написать failing-тест round-trip объектов**

`backend/tests/integration/test_backup_roundtrip.py`:

```python
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
```

> Тест требует запущенного MinIO (`docker compose up -d minio`). conftest задаёт
> `S3_BUCKET=malika-test` и креды minioadmin.

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py::test_download_then_upload_objects -v`
Expected: FAIL (нет storage_ops).

- [ ] **Step 3: Реализовать storage_ops**

`backend/app/features/backup/storage_ops.py`:

```python
"""Массовые операции с object storage для бэкапа.

Тонкие обёртки над `minio`-клиентом из app.common.storage — НЕ раздуваем
общий storage.py операциями, нужными только бэкапу.
"""

from __future__ import annotations

from pathlib import Path

from app.common.storage import _client
from app.core.config import get_settings


def iter_keys() -> list[str]:
    settings = get_settings()
    client = _client()
    return [
        obj.object_name
        for obj in client.list_objects(settings.s3_bucket, recursive=True)
    ]


def download_all(dest: Path) -> int:
    """Скачать все объекты бакета в dest/<key>. Вернуть число файлов."""
    settings = get_settings()
    client = _client()
    count = 0
    for key in iter_keys():
        target = dest / key
        target.parent.mkdir(parents=True, exist_ok=True)
        client.fget_object(settings.s3_bucket, key, str(target))
        count += 1
    return count


def upload_all(src: Path) -> int:
    """Залить все файлы из src обратно в бакет (overwrite по ключу)."""
    settings = get_settings()
    client = _client()
    count = 0
    for path in src.rglob("*"):
        if not path.is_file():
            continue
        key = str(path.relative_to(src))
        client.fput_object(settings.s3_bucket, key, str(path))
        count += 1
    return count
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py::test_download_then_upload_objects -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/backup/storage_ops.py backend/tests/integration/test_backup_roundtrip.py
git commit -m "feat(backup): bulk download/upload of object storage"
```

---

## Task 5: service.create_backup (+ prune)

**Files:**
- Create: `backend/app/features/backup/service.py`
- Test: дополнить `backend/tests/integration/test_backup_roundtrip.py`

- [ ] **Step 1: Написать failing-тест полного бэкапа**

Добавить в `test_backup_roundtrip.py`:

```python
import tarfile

from app.features.backup import repository as repo
from app.features.backup import service
from app.features.backup.models import BackupStatus, BackupTrigger


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
```

> `service.get_settings()` — подтверди, что в service импортируется
> `from app.core.config import get_settings`. monkeypatch меняет backup_dir на
> временную папку, чтобы не писать в `/backups`.

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py::test_create_backup_produces_archive -v`
Expected: FAIL.

- [ ] **Step 3: Реализовать service (create_backup + prune + helpers)**

`backend/app/features/backup/service.py`:

```python
"""Ядро бэкапа: создание архива, восстановление, ретеншн, доставка в TG."""

from __future__ import annotations

import asyncio
import json
import os
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.features.backup import repository as repo
from app.features.backup import storage_ops
from app.features.backup.models import BackupRun, BackupStatus, BackupTrigger

APP_VERSION = "1.0.0"  # при наличии — взять из единого источника версии


async def _alembic_revision(db: AsyncSession) -> str | None:
    row = await db.execute(text("SELECT version_num FROM alembic_version"))
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
            f"{args[0]} exited {proc.returncode}: {stderr.decode(errors='replace')[:500]}"
        )


def _pg_url(async_url: str) -> str:
    # pg_dump хочет обычный URL без +asyncpg
    return async_url.replace("+asyncpg", "")


async def create_backup(db: AsyncSession, *, trigger: BackupTrigger) -> BackupRun:
    settings = get_settings()
    run = await repo.create_run(db, trigger=trigger)
    await db.commit()

    ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
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
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py::test_create_backup_produces_archive -v`
Expected: PASS. (Требует pg_dump в PATH — локально установить `postgresql-client-16` или гонять в контейнере backend.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/backup/service.py backend/tests/integration/test_backup_roundtrip.py
git commit -m "feat(backup): create_backup (pg_dump + objects + manifest -> tar.gz) and prune"
```

---

## Task 6: service.restore_backup (полный round-trip)

**Files:**
- Modify: `backend/app/features/backup/service.py`
- Test: дополнить `test_backup_roundtrip.py`

- [ ] **Step 1: Написать failing-тест восстановления**

Добавить в `test_backup_roundtrip.py`:

```python
from sqlalchemy import text as sql_text


@pytest.mark.asyncio
async def test_restore_returns_data(db, tmp_path, monkeypatch):
    monkeypatch.setattr(service.get_settings(), "backup_dir", str(tmp_path), raising=False)
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
    data = storage._client().get_object(storage.get_settings().s3_bucket, "0/test/restore/a.txt").read()
    assert data == b"v1"
```

> NB: restore делает `pg_restore --clean` — он сбросит и пересоздаст таблицы.
> Тест проверяет главным образом возврат объекта; для проверки БД-строк можно
> при желании сверять count до/после.

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py::test_restore_returns_data -v`
Expected: FAIL (нет restore_backup).

- [ ] **Step 3: Реализовать restore_backup**

Добавить в `service.py`:

```python
class RevisionMismatch(RuntimeError):
    pass


async def restore_backup(
    db: AsyncSession, archive_path: Path, *, force: bool = False
) -> None:
    settings = get_settings()
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(work)  # noqa: S202 — наш собственный архив
        manifest = json.loads((work / "manifest.json").read_text())

        current = await _alembic_revision(db)
        if not force and manifest.get("alembic_revision") != current:
            raise RevisionMismatch(
                f"archive revision {manifest.get('alembic_revision')} != current {current}"
            )

        await _run_subprocess(
            "pg_restore", "--clean", "--if-exists", "--no-owner",
            "-d", _pg_url(str(settings.database_url)),
            str(work / "database.dump"),
        )
        storage_ops.upload_all(work / "objects")
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py::test_restore_returns_data -v`
Expected: PASS.

- [ ] **Step 5: Прогнать весь файл и закоммитить**

Run: `cd backend && uv run pytest tests/integration/test_backup_roundtrip.py -v`
Expected: все PASS.

```bash
git add backend/app/features/backup/service.py backend/tests/integration/test_backup_roundtrip.py
git commit -m "feat(backup): restore_backup with revision guard + object re-upload"
```

---

## Task 7: TG-доставка + split

**Files:**
- Modify: `backend/app/features/backup/service.py`
- Test: `backend/tests/integration/test_backup_split.py`

- [ ] **Step 1: Написать failing-тест разрезки/склейки**

`backend/tests/integration/test_backup_split.py`:

```python
from pathlib import Path

from app.features.backup import service


def test_split_and_join_roundtrip(tmp_path):
    src = tmp_path / "archive.tar.gz"
    src.write_bytes(b"X" * (3 * 1024 * 1024 + 123))  # 3MB+
    parts = service.split_file(src, part_size_mb=1, backup_id=42, stamp="20260612-000000")
    assert len(parts) == 4
    for i, p in enumerate(parts, 1):
        assert Path(p).name == f"malika-backup-42-20260612-000000.part{i:02d}"
    # склейка
    joined = tmp_path / "joined.bin"
    with open(joined, "wb") as out:
        for p in parts:
            out.write(Path(p).read_bytes())
    assert joined.read_bytes() == src.read_bytes()
```

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_split.py -v`
Expected: FAIL.

- [ ] **Step 3: Реализовать split_file и deliver_to_tg**

Добавить в `service.py`:

```python
def split_file(
    path: Path, *, part_size_mb: int, backup_id: int, stamp: str
) -> list[str]:
    part_size = part_size_mb * 1024 * 1024
    parts: list[str] = []
    with open(path, "rb") as src:
        idx = 1
        while True:
            chunk = src.read(part_size)
            if not chunk:
                break
            name = f"malika-backup-{backup_id}-{stamp}.part{idx:02d}"
            part_path = path.parent / name
            part_path.write_bytes(chunk)
            parts.append(str(part_path))
            idx += 1
    return parts


async def deliver_to_tg(db: AsyncSession, run: BackupRun, bot) -> None:
    """Отправить бэкап в Telegram по настройкам config. `bot` — aiogram.Bot."""
    from aiogram.types import FSInputFile

    from app.features.backup.models import TgDeliveryMode

    cfg = await repo.get_or_create_config(db)
    if not cfg.tg_chat_id or not run.filename:
        return
    settings = get_settings()
    archive = Path(settings.backup_dir) / run.filename
    stamp = run.created_at.strftime("%Y%m%d-%H%M%S")
    limit_bytes = cfg.tg_part_size_mb * 1024 * 1024

    mode = cfg.tg_delivery_mode
    if mode == TgDeliveryMode.full_if_fits and (run.size_bytes or 0) > limit_bytes:
        mode = TgDeliveryMode.db_only  # graceful fallback

    if mode == TgDeliveryMode.split:
        parts = split_file(
            archive, part_size_mb=cfg.tg_part_size_mb,
            backup_id=run.id, stamp=stamp,
        )
        try:
            for i, p in enumerate(parts, 1):
                await bot.send_document(
                    cfg.tg_chat_id, FSInputFile(p),
                    caption=f"Бэкап #{run.id} · {stamp} · часть {i}/{len(parts)}",
                )
        finally:
            for p in parts:
                Path(p).unlink(missing_ok=True)
    elif mode == TgDeliveryMode.db_only:
        with tempfile.TemporaryDirectory() as tmp:
            with tarfile.open(archive, "r:gz") as tar:
                tar.extract("database.dump", tmp)  # noqa: S202
            await bot.send_document(
                cfg.tg_chat_id, FSInputFile(Path(tmp) / "database.dump"),
                caption=f"Бэкап #{run.id} · {stamp} · только БД "
                        f"(полный архив — в админке)",
            )
    else:  # full_if_fits и влезает
        await bot.send_document(
            cfg.tg_chat_id, FSInputFile(str(archive)),
            caption=f"Бэкап #{run.id} · {stamp}",
        )

    run.sent_to_tg = True
    await db.commit()
```

- [ ] **Step 4: Запустить split-тест — пройдёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_split.py -v`
Expected: PASS. (deliver_to_tg покрываем в Task 10 API-тестом с фейковым ботом.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/backup/service.py backend/tests/integration/test_backup_split.py
git commit -m "feat(backup): telegram delivery (full/db_only/split) + file splitting"
```

---

## Task 8: Schemas

**Files:**
- Create: `backend/app/features/backup/schemas.py`

- [ ] **Step 1: Написать схемы**

`backend/app/features/backup/schemas.py`:

```python
from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.features.backup.models import (
    BackupFrequency,
    BackupStatus,
    BackupTrigger,
    TgDeliveryMode,
)


class ConfigIn(BaseModel):
    enabled: bool
    frequency: BackupFrequency
    daily_time: time | None = None
    interval_hours: int | None = Field(default=None, ge=1, le=168)
    retention_count: int = Field(ge=1, le=100)
    tg_chat_id: int | None = None
    tg_auto_send: bool = False
    tg_delivery_mode: TgDeliveryMode = TgDeliveryMode.full_if_fits
    tg_part_size_mb: int = Field(default=49, ge=1, le=49)


class ConfigOut(ConfigIn):
    model_config = ConfigDict(from_attributes=True)
    updated_at: datetime


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    status: BackupStatus
    trigger: BackupTrigger
    filename: str | None
    size_bytes: int | None
    object_count: int | None
    sent_to_tg: bool
    error: str | None
```

- [ ] **Step 2: Импорт-чек**

Run: `cd backend && uv run python -c "import app.features.backup.schemas"`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add backend/app/features/backup/schemas.py
git commit -m "feat(backup): pydantic schemas for config and runs"
```

---

## Task 9: Router (admin-эндпоинты) + подключение

**Files:**
- Create: `backend/app/features/backup/router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_backup_api.py`

- [ ] **Step 1: Написать failing API-тест (авторизация + config + run + restore)**

`backend/tests/integration/test_backup_api.py`:

```python
import pytest

# admin_client / client — фикстуры conftest. Подтверди имена в conftest;
# если admin-фикстуры нет, создай JWT с is_admin=True по образцу test_admin.py.


@pytest.mark.asyncio
async def test_config_requires_admin(client):
    r = await client.get("/api/v1/admin/backup/config")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_and_put_config(admin_client):
    r = await admin_client.get("/api/v1/admin/backup/config")
    assert r.status_code == 200
    body = r.json()
    body["retention_count"] = 5
    body["frequency"] = "daily"
    body["daily_time"] = "03:00:00"
    r2 = await admin_client.put("/api/v1/admin/backup/config", json=body)
    assert r2.status_code == 200
    assert r2.json()["retention_count"] == 5
```

> Открой `backend/tests/integration/test_admin.py` и переиспользуй принятый там
> способ получить авторизованного админ-клиента (фикстура или хелпер выдачи
> admin-JWT). Назови фикстуру `admin_client` или адаптируй тест под существующую.

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_api.py -v`
Expected: FAIL (404 — нет роутера).

- [ ] **Step 3: Реализовать router**

`backend/app/features/backup/router.py`:

```python
"""Admin-эндпоинты системы бэкапа (все под CurrentAdmin)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db  # подтверди имя dependency для сессии
from app.features.admin.auth import CurrentAdmin
from app.features.backup import repository as repo
from app.features.backup import service
from app.features.backup.models import BackupTrigger
from app.features.backup.schemas import ConfigIn, ConfigOut, RunOut

router = APIRouter(prefix="/admin/backup", tags=["backup"])


@router.get("/config", response_model=ConfigOut)
async def get_config(
    db: AsyncSession = Depends(get_db), admin=Depends(CurrentAdmin)
):
    return await repo.get_or_create_config(db)


@router.put("/config", response_model=ConfigOut)
async def put_config(
    payload: ConfigIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin=Depends(CurrentAdmin),
):
    cfg = await repo.get_or_create_config(db)
    for field, value in payload.model_dump().items():
        setattr(cfg, field, value)
    await db.commit()
    # перенастроить расписание
    from bot.scheduler import apply_backup_schedule

    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler is not None:
        apply_backup_schedule(scheduler, cfg)
    return cfg


@router.get("/runs", response_model=list[RunOut])
async def list_runs(
    db: AsyncSession = Depends(get_db), admin=Depends(CurrentAdmin)
):
    return await repo.list_runs(db)


@router.post("/run", response_model=RunOut)
async def run_now(
    db: AsyncSession = Depends(get_db), admin=Depends(CurrentAdmin)
):
    return await service.create_backup(db, trigger=BackupTrigger.manual)


@router.get("/runs/{run_id}/download")
async def download(
    run_id: int, db: AsyncSession = Depends(get_db), admin=Depends(CurrentAdmin)
):
    from app.features.backup.models import BackupRun

    run = await db.get(BackupRun, run_id)
    if run is None or not run.filename:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    path = Path(get_settings().backup_dir) / run.filename
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "archive missing on disk")
    return FileResponse(path, filename=run.filename, media_type="application/gzip")


@router.post("/runs/{run_id}/send-telegram", response_model=RunOut)
async def send_telegram(
    run_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin=Depends(CurrentAdmin),
):
    from app.features.backup.models import BackupRun

    run = await db.get(BackupRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    bot = getattr(request.app.state, "bot", None)
    if bot is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "bot unavailable")
    await service.deliver_to_tg(db, run, bot)
    return run


@router.post("/restore", response_model=RunOut | None)
async def restore(
    file: UploadFile,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    admin=Depends(CurrentAdmin),
):
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)
    try:
        try:
            await service.restore_backup(db, tmp_path, force=force)
        except service.RevisionMismatch as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    finally:
        tmp_path.unlink(missing_ok=True)
    return None
```

> ⚠️ `get_db` — подставь по факту: открой любой router (`reports/router.py`) и
> используй ТО ЖЕ имя dependency сессии, что в проекте.

- [ ] **Step 4: Подключить router в app.main**

В `backend/app/main.py` рядом с другими `include_router` (после строки 227):

```python
from app.features.backup.router import router as backup_router
app.include_router(backup_router, prefix="/api/v1")
```

- [ ] **Step 5: Запустить API-тесты — пройдут**

Run: `cd backend && uv run pytest tests/integration/test_backup_api.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/features/backup/router.py backend/app/main.py backend/tests/integration/test_backup_api.py
git commit -m "feat(backup): admin REST endpoints (config/runs/run/download/telegram/restore)"
```

---

## Task 10: Расписание в APScheduler + app.state

**Files:**
- Modify: `backend/bot/scheduler.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_backup_schedule.py`

- [ ] **Step 1: Написать failing-тест apply_backup_schedule**

`backend/tests/integration/test_backup_schedule.py`:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from bot.scheduler import apply_backup_schedule
from app.features.backup.models import BackupConfig, BackupFrequency
from datetime import time


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
```

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && uv run pytest tests/integration/test_backup_schedule.py -v`
Expected: FAIL.

- [ ] **Step 3: Реализовать apply_backup_schedule в bot/scheduler.py**

Добавить в `backend/bot/scheduler.py`:

```python
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.common.dates import TASHKENT
from app.features.backup.models import BackupConfig, BackupFrequency, BackupTrigger

# Глобальная ссылка на bot для backup-джобы (ставится из app.main lifespan).
_backup_bot = None


def set_backup_bot(bot) -> None:
    global _backup_bot
    _backup_bot = bot


async def _run_scheduled_backup() -> None:
    from app.core.database import SessionFactory
    from app.features.backup import repository as repo
    from app.features.backup import service

    async with SessionFactory() as db:
        run = await service.create_backup(db, trigger=BackupTrigger.auto)
        cfg = await repo.get_or_create_config(db)
        if cfg.tg_auto_send and _backup_bot is not None:
            await service.deliver_to_tg(db, run, _backup_bot)


def apply_backup_schedule(scheduler, cfg: BackupConfig) -> None:
    """Добавить/перенастроить/снять job 'backup' по конфигу."""
    existing = scheduler.get_job("backup")
    if existing:
        scheduler.remove_job("backup")
    if not cfg.enabled or cfg.frequency == BackupFrequency.off:
        return
    if cfg.frequency == BackupFrequency.daily and cfg.daily_time:
        trigger = CronTrigger(
            hour=cfg.daily_time.hour, minute=cfg.daily_time.minute, timezone=TASHKENT
        )
    elif cfg.frequency == BackupFrequency.interval and cfg.interval_hours:
        trigger = IntervalTrigger(hours=cfg.interval_hours)
    else:
        return
    scheduler.add_job(_run_scheduled_backup, trigger=trigger, id="backup")
```

> Проверь, что `TASHKENT` экспортируется из `app.common.dates` (используется в
> существующих джобах этого файла).

- [ ] **Step 4: Зарегистрировать на старте + положить bot/scheduler в app.state**

В `backend/app/main.py` lifespan, после `scheduler = build_scheduler()` (стр.~109)
и `bot = build_bot()` (стр.~107):

```python
    app.state.bot = bot
    app.state.scheduler = scheduler

    from bot.scheduler import apply_backup_schedule, set_backup_bot
    from app.features.backup import repository as backup_repo
    from app.core.database import SessionFactory

    set_backup_bot(bot)
    async with SessionFactory() as _db:
        _cfg = await backup_repo.get_or_create_config(_db)
        await _db.commit()
    apply_backup_schedule(scheduler, _cfg)
```

> Размести это ПОСЛЕ `scheduler.start()` либо до — APScheduler допускает add_job
> до start. Главное: после создания bot и scheduler.

- [ ] **Step 5: Запустить тесты — пройдут**

Run: `cd backend && uv run pytest tests/integration/test_backup_schedule.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/bot/scheduler.py backend/app/main.py backend/tests/integration/test_backup_schedule.py
git commit -m "feat(backup): APScheduler integration + runtime reschedule + auto TG send"
```

---

## Task 11: CLI-скрипты

**Files:**
- Create: `backend/scripts/__init__.py` (если отсутствует), `backend/scripts/backup.py`, `backend/scripts/restore.py`

- [ ] **Step 1: backup.py**

```python
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
```

- [ ] **Step 2: restore.py**

```python
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
```

- [ ] **Step 3: Smoke-проверка backup CLI**

Run (с локальной БД и MinIO):
```bash
cd backend && BACKUP_DIR=/tmp/malika-backups uv run python -m scripts.backup
```
Expected: печатает `OK: backup #N -> malika-backup-….tar.gz`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/backup.py backend/scripts/restore.py
git commit -m "feat(backup): CLI backup/restore wrappers"
```

---

## Task 12: Админка — страница «Бэкап»

**Files:**
- Create: `admin/src/pages/Backup.tsx`, `admin/src/api/backup.ts`
- Modify: `admin/src/App.tsx` (роут + навигация), `admin/src/i18n/ru.json`, `admin/src/i18n/uz.json`

- [ ] **Step 1: Изучить образец существующей страницы**

Открой `admin/src/pages/Users.tsx` и `admin/src/api/` — повтори ИХ паттерн
(хук запроса, axios-инстанс, обработка ошибок, i18n через `t()`). Навигацию
добавь там же, где зарегистрированы остальные пункты (найди в `App.tsx` или
layout-компоненте по `Users`/`Stats`).

- [ ] **Step 2: API-слой `admin/src/api/backup.ts`**

```ts
import { api } from './client'; // используй существующий axios-инстанс админки

export interface BackupConfig {
  enabled: boolean;
  frequency: 'off' | 'daily' | 'interval';
  daily_time: string | null;
  interval_hours: number | null;
  retention_count: number;
  tg_chat_id: number | null;
  tg_auto_send: boolean;
  tg_delivery_mode: 'full_if_fits' | 'db_only' | 'split';
  tg_part_size_mb: number;
  updated_at: string;
}

export interface BackupRun {
  id: number;
  created_at: string;
  status: 'running' | 'ok' | 'failed';
  trigger: 'manual' | 'auto';
  filename: string | null;
  size_bytes: number | null;
  object_count: number | null;
  sent_to_tg: boolean;
  error: string | null;
}

export const getConfig = () => api.get<BackupConfig>('/admin/backup/config').then(r => r.data);
export const putConfig = (c: BackupConfig) => api.put<BackupConfig>('/admin/backup/config', c).then(r => r.data);
export const listRuns = () => api.get<BackupRun[]>('/admin/backup/runs').then(r => r.data);
export const runNow = () => api.post<BackupRun>('/admin/backup/run').then(r => r.data);
export const sendTg = (id: number) => api.post<BackupRun>(`/admin/backup/runs/${id}/send-telegram`).then(r => r.data);
export const downloadUrl = (id: number) => `/api/v1/admin/backup/runs/${id}/download`;
export const restore = (file: File, force: boolean) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/admin/backup/restore?force=${force}`, fd);
};
```

> Подтверди базовый префикс axios-инстанса (`/api/v1` или нет) — `downloadUrl`
> и пути в api-функциях должны совпасть с тем, как сконфигурирован `client`.

- [ ] **Step 3: Страница `admin/src/pages/Backup.tsx`**

Реализуй (следуя стилю проекта/shadcn): форму настроек (тумблер `enabled`,
селект `frequency`, поле времени/часов, `retention_count`, TG-блок: `tg_chat_id`,
`tg_auto_send`, `tg_delivery_mode`, `tg_part_size_mb`), кнопку «Сделать бэкап
сейчас» (`runNow`), таблицу истории (`listRuns`) с «Скачать» (ссылка на
`downloadUrl`) и «В Telegram» (`sendTg`), и блок восстановления: `<input
type=file>` + чекбокс подтверждения + красное предупреждение, вызывающий
`restore`. Все подписи — через `t('backup.*')`.

- [ ] **Step 4: i18n-ключи**

В `admin/src/i18n/ru.json` и `uz.json` добавь ветку `backup.*` (заголовки,
лейблы полей, кнопки, предупреждение о restore, статусы). Покрой ОБА языка.

- [ ] **Step 5: Сборка админки**

Run: `cd admin && pnpm build`
Expected: `built` без ошибок TypeScript.

- [ ] **Step 6: Commit**

```bash
git add admin/src/pages/Backup.tsx admin/src/api/backup.ts admin/src/App.tsx admin/src/i18n/ru.json admin/src/i18n/uz.json
git commit -m "feat(admin): backup page — config, run history, restore upload"
```

---

## Task 13: Документация

**Files:**
- Modify: `README.md`, `deploy/README.md`, `deploy/.env.prod.example`

- [ ] **Step 1: README — раздел «Бэкап»**

Добавь в `README.md` секцию: что в архиве, как сделать бэкап (админка/CLI/авто),
restore (админка-загрузка/CLI, предупреждение про окно простоя), сборка
TG-частей: `cat malika-backup-<id>-<дата>.part* > archive.tar.gz`.

- [ ] **Step 2: deploy — volume и pg client**

В `deploy/README.md` отметь volume `backup_data` (где живут архивы, как
бэкапить сам volume наружу) и что backend-образ содержит `pg_dump 16`.
В `deploy/.env.prod.example` добавь `BACKUP_DIR=/backups`.

- [ ] **Step 3: Commit**

```bash
git add README.md deploy/README.md deploy/.env.prod.example
git commit -m "docs(backup): backup/restore usage, TG part reassembly, volume notes"
```

---

## Task 14: Полный прогон и финальная проверка

- [ ] **Step 1: Backend — все тесты**

Run:
```bash
docker compose --profile test up -d postgres_test
docker compose up -d minio
cd backend && uv run pytest -q
```
Expected: все PASS (прежние 159 + новые backup-тесты).

- [ ] **Step 2: Фронт-сборки**

Run: `cd admin && pnpm build`
Expected: OK.

- [ ] **Step 3: Сборка backend-образа (pg_dump в образе)**

Run: `docker compose build backend`
Expected: образ собирается, в нём есть `pg_dump --version` → 16.x.

- [ ] **Step 4: Финальный commit (если остались мелочи)**

```bash
git add -A && git commit -m "chore(backup): final wiring & verification"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеца:** config/runs (T2-3), storage (T4), create/prune (T5),
  restore (T6), TG+split (T7), schemas (T8), API+wiring (T9), schedule+auto-send
  (T10), CLI (T11), admin UI (T12), docs (T13), verification (T14). ✓
- **Плейсхолдеры:** в коде их нет; есть явные «подтверди имя X в файле Y» —
  это действия-проверки точек интеграции (имя сессии-dependency, имя admin-
  фикстуры, declarative Base), а не TODO в коде. Исполнителю ОБЯЗАТЕЛЬНО
  свериться с реальными именами перед написанием.
- **Согласованность типов:** `create_backup(db, trigger=…)`, `restore_backup(db,
  path, force=)`, `deliver_to_tg(db, run, bot)`, `apply_backup_schedule(scheduler,
  cfg)`, `split_file(path, part_size_mb, backup_id, stamp)` — имена совпадают
  между задачами. ✓

## Точки интеграции, которые ОБЯЗАТЕЛЬНО свериться в коде (перед началом)

1. Declarative `Base` — `backend/app/core/database.py`.
2. Имя dependency сессии в роутерах (`get_db`?) — взять из `reports/router.py`.
3. Имя async-сессии фабрики (`SessionFactory`) — `app/core/database.py`.
4. Admin-guard `CurrentAdmin` — `app/features/admin/auth.py`.
5. Имена тест-фикстур (`db`, `client`, admin-клиент) — `backend/tests/conftest.py`
   и `tests/integration/test_admin.py`.
6. `TASHKENT` — `app/common/dates.py`.
7. Точная строка `down_revision` ревизии 0017 — шапка `0017_add_user_notify_chat.py`.
8. Admin axios-инстанс и его baseURL — `admin/src/api/`.
