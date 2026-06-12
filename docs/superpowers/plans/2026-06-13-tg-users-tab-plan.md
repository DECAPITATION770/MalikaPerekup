# Telegram-Users Tab (step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обогатить админскую страницу «Пользователи» реальными аватарами из Telegram, кликабельными ссылками `t.me/<username>` и подробным статусом «клиент» (из плана магазина).

**Architecture:** Новые поля `users.avatar_key`/`avatar_fetched_at`. При входе через Telegram фоновая задача (FastAPI BackgroundTasks, бот из `app.state.bot`) тянет фото → MinIO → presigned URL в админку. Чистая функция `client_status(shop, today)` даёт 5-state бейдж; `GET /admin/users` батч-грузит магазины (без N+1).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, aiogram 3.13+, minio, pytest (реальный Postgres+MinIO), React 18 + Vite + TS.

**Спецификация:** `docs/superpowers/specs/2026-06-13-tg-users-tab-design.md` — читать перед началом.

**Запуск тестов backend (порт 5433 занят чужим проектом — malika_test в malika_postgres):**
```bash
docker compose up -d postgres minio
cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" \
  REDIS_URL="redis://localhost:6379/15" uv run pytest
```

---

## File Structure

**Backend:**
- Modify `app/features/auth/models.py` — `avatar_key`, `avatar_fetched_at`.
- Create `backend/alembic/versions/0020_add_user_avatar.py`.
- Create `app/features/auth/avatars.py` — `refresh_avatar`, `refresh_avatar_bg`.
- Modify `app/features/auth/router.py` — запуск фоновой задачи на входе.
- Modify `app/features/admin/service.py` — `client_status`.
- Modify `app/features/admin/schemas.py` — `OwnerOut` += `avatar_url`, `client_status`.
- Modify `app/features/admin/router.py` — `_owner_out(user, shop)` + батч магазинов в `list_users` + shop в `get_user`.
- Tests: `tests/unit/test_client_status.py`, `tests/integration/test_avatars.py`, дополнить `tests/integration/test_admin.py`.

**Frontend admin:**
- Modify `admin/src/types.ts` — `OwnerOut` += поля.
- Modify `admin/src/pages/Users.tsx` — `<img>` аватар, t.me-ссылка, бейдж статуса.
- Modify `admin/src/i18n/{ru,uz}.json` — `users.status_*`.

---

## Task 1: Модель + миграция 0020

**Files:**
- Modify: `backend/app/features/auth/models.py`
- Create: `backend/alembic/versions/0020_add_user_avatar.py`

- [ ] **Step 1: Поля в модель User**

В `backend/app/features/auth/models.py`, в класс `User`, после блока «Blocking»
(после `blocked_at`), добавить:

```python
    # ── Telegram avatar (fetched on login, cached in object storage) ──
    avatar_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

В импортах `sqlalchemy` того же файла добавить `Text`:

```python
from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
```

- [ ] **Step 2: Миграция 0020**

Создать `backend/alembic/versions/0020_add_user_avatar.py`:

```python
"""add users.avatar_key and avatar_fetched_at

Revision ID: 0020_add_user_avatar
Revises: 0019_add_user_is_blocked
Create Date: 2026-06-13 12:00:00

Cached Telegram profile photo (object-storage key) + last fetch timestamp.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_add_user_avatar"
down_revision: str | None = "0019_add_user_is_blocked"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_key", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("avatar_fetched_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_fetched_at")
    op.drop_column("users", "avatar_key")
```

- [ ] **Step 3: Применить и проверить обратимость (dev DB malika)**

Run:
```bash
cd backend
export DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika"
uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head
```
Expected: без ошибок; колонки `avatar_key`/`avatar_fetched_at` создаются и удаляются.

- [ ] **Step 4: Commit**

```bash
git add backend/app/features/auth/models.py backend/alembic/versions/0020_add_user_avatar.py
git commit -m "feat(tg-users): users.avatar_key + avatar_fetched_at (model + migration 0020)"
```

---

## Task 2: client_status (чистая функция)

**Files:**
- Modify: `backend/app/features/admin/service.py`
- Test: `backend/tests/unit/test_client_status.py`

- [ ] **Step 1: Написать failing-тест**

Создать `backend/tests/unit/test_client_status.py`:

```python
from datetime import date
from types import SimpleNamespace

from app.features.admin.service import client_status

TODAY = date(2026, 6, 13)


def _shop(plan="basic", plan_until=None, is_frozen=False):
    return SimpleNamespace(plan=plan, plan_until=plan_until, is_frozen=is_frozen)


def test_no_shop():
    assert client_status(None, TODAY) == "no_shop"


def test_frozen_takes_priority():
    assert client_status(_shop(plan="basic", is_frozen=True), TODAY) == "frozen"


def test_expired():
    assert client_status(_shop(plan="basic", plan_until=date(2026, 6, 1)), TODAY) == "expired"


def test_client_basic_active():
    assert client_status(_shop(plan="basic", plan_until=date(2026, 12, 1)), TODAY) == "client"


def test_trial():
    assert client_status(_shop(plan="trial"), TODAY) == "trial"
```

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/unit/test_client_status.py -v`
Expected: FAIL (ImportError client_status).

- [ ] **Step 3: Реализовать**

В `backend/app/features/admin/service.py` добавить (рядом с прочими функциями;
тип `shop` намеренно широкий — функция читает только три поля):

```python
def client_status(shop, today) -> str:
    """Derive the platform-client status badge from a user's shop.

    Priority: no shop > frozen > expired plan > paid (basic) > trial.
    """
    if shop is None:
        return "no_shop"
    if shop.is_frozen:
        return "frozen"
    if shop.plan_until is not None and shop.plan_until < today:
        return "expired"
    if shop.plan == "basic":
        return "client"
    return "trial"
```

- [ ] **Step 4: Запустить — пройдёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/unit/test_client_status.py -v`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/admin/service.py backend/tests/unit/test_client_status.py
git commit -m "feat(tg-users): client_status derivation (5-state) + tests"
```

---

## Task 3: Аватар-сервис refresh_avatar

**Files:**
- Create: `backend/app/features/auth/avatars.py`
- Test: `backend/tests/integration/test_avatars.py`

- [ ] **Step 1: Написать failing-тесты (фейковый бот + MinIO)**

Создать `backend/tests/integration/test_avatars.py`:

```python
import io
from datetime import timedelta
from types import SimpleNamespace

import pytest

from app.common import storage
from app.common.dates import now_utc
from app.features.auth import avatars
from app.features.auth.models import User


class _FakeBot:
    """Minimal aiogram-shaped stub for refresh_avatar."""

    def __init__(self, *, photo_bytes: bytes | None):
        self._photo_bytes = photo_bytes
        self.profile_calls = 0

    async def get_user_profile_photos(self, user_id, limit=1):
        self.profile_calls += 1
        if self._photo_bytes is None:
            return SimpleNamespace(total_count=0, photos=[])
        size = SimpleNamespace(file_id="FILE123")
        return SimpleNamespace(total_count=1, photos=[[size]])

    async def get_file(self, file_id):
        return SimpleNamespace(file_path="photos/file_123.jpg")

    async def download_file(self, file_path):
        return io.BytesIO(self._photo_bytes)


@pytest.mark.asyncio
async def test_refresh_avatar_stores_photo(db):
    storage.ensure_bucket()
    user = User(full_name="Ava", tg_id=800001)
    db.add(user)
    await db.commit()

    bot = _FakeBot(photo_bytes=b"\xff\xd8jpegbytes")
    await avatars.refresh_avatar(bot, db, user)

    assert user.avatar_key == f"avatars/{user.id}.jpg"
    assert user.avatar_fetched_at is not None
    data = storage._client().get_object(
        storage.get_settings().s3_bucket, user.avatar_key
    ).read()
    assert data == b"\xff\xd8jpegbytes"


@pytest.mark.asyncio
async def test_refresh_avatar_no_photo_sets_timestamp_only(db):
    user = User(full_name="NoPic", tg_id=800002)
    db.add(user)
    await db.commit()

    bot = _FakeBot(photo_bytes=None)
    await avatars.refresh_avatar(bot, db, user)

    assert user.avatar_key is None
    assert user.avatar_fetched_at is not None


@pytest.mark.asyncio
async def test_refresh_avatar_throttled(db):
    user = User(full_name="Fresh", tg_id=800003, avatar_fetched_at=now_utc())
    db.add(user)
    await db.commit()

    bot = _FakeBot(photo_bytes=b"x")
    await avatars.refresh_avatar(bot, db, user)
    assert bot.profile_calls == 0  # skipped — fetched <7d ago
```

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_avatars.py -v`
Expected: FAIL (нет модуля avatars).

- [ ] **Step 3: Реализовать avatars.py**

Создать `backend/app/features/auth/avatars.py`:

```python
"""Telegram profile-photo caching for the admin Users view.

Fetched fire-and-forget after a successful Telegram login, stored in object
storage (private), served to the admin via presigned URLs.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.common import storage
from app.common.dates import now_utc
from app.core.database import SessionFactory
from app.core.logging import logger
from app.features.auth import repository as user_repo
from app.features.auth.models import User

_REFRESH_EVERY = timedelta(days=7)


async def refresh_avatar(bot, db: AsyncSession, user: User) -> None:
    """Fetch the user's Telegram photo into object storage (best-effort)."""
    if user.tg_id is None:
        return
    if (
        user.avatar_fetched_at is not None
        and now_utc() - user.avatar_fetched_at < _REFRESH_EVERY
    ):
        return

    photos = await bot.get_user_profile_photos(user.tg_id, limit=1)
    if not getattr(photos, "total_count", 0) or not photos.photos:
        user.avatar_fetched_at = now_utc()
        await db.commit()
        return

    largest = photos.photos[0][-1]  # biggest PhotoSize of the first photo
    file = await bot.get_file(largest.file_id)
    buf = await bot.download_file(file.file_path)
    key = f"avatars/{user.id}.jpg"
    storage.upload(key, buf.read(), "image/jpeg")
    user.avatar_key = key
    user.avatar_fetched_at = now_utc()
    await db.commit()


async def refresh_avatar_bg(user_id: int, bot) -> None:
    """Background entrypoint: own session, swallow errors (fire-and-forget)."""
    try:
        async with SessionFactory() as db:
            user = await user_repo.get_by_id(db, user_id)
            if user is not None:
                await refresh_avatar(bot, db, user)
    except Exception as exc:  # noqa: BLE001 — never break login on avatar refresh
        logger.warning("avatar.refresh_failed", user_id=user_id, error=str(exc))
```

> Проверь импорт логгера: открой `app/core/logging.py` и подтверди, что
> экспортируется `logger` (используется в `app/main.py`). Если имя другое —
> поправь импорт.

- [ ] **Step 4: Запустить — пройдёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_avatars.py -v`
Expected: 3 PASS. (Требует запущенного MinIO.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/auth/avatars.py backend/tests/integration/test_avatars.py
git commit -m "feat(tg-users): avatar fetch/cache service (refresh_avatar) + tests"
```

---

## Task 4: Запуск рефреша аватара на входе

**Files:**
- Modify: `backend/app/features/auth/router.py`

- [ ] **Step 1: Подключить фоновую задачу в login_via_telegram**

В `backend/app/features/auth/router.py`:

1. В импорты добавить:
```python
from fastapi import BackgroundTasks, Request
from app.features.auth import avatars
```
(объедини с существующими импортами `fastapi`, не дублируй `APIRouter`/`HTTPException`/`status`/`Depends`.)

2. Изменить сигнатуру и тело эндпоинта `login_via_telegram`:
```python
async def login_via_telegram(
    req: TelegramAuthRequest,
    db: DbSession,
    request: Request,
    background_tasks: BackgroundTasks,
) -> TokenResponse:
    """Mini App auth: send ``initData``, receive a JWT."""
    try:
        user, token = await service.login_via_telegram(db, req.init_data)
    except service.UserBlockedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, {"code": "user_blocked"}
        ) from exc
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    bot = getattr(request.app.state, "bot", None)
    if bot is not None:
        background_tasks.add_task(avatars.refresh_avatar_bg, user.id, bot)
    return TokenResponse(access_token=token, user_id=user.id)
```

> Сверь текущее тело `login_via_telegram` (после Task BL-T4 там уже есть
> `UserBlockedError`-ветка) и добавь только фоновую задачу + новые параметры.

- [ ] **Step 2: Проверить импорт приложения**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run python -c "import app.main; print('ok')"`
Expected: `ok`.

- [ ] **Step 3: Регрессия auth-тестов**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -q`
Expected: все PASS (вход по-прежнему работает; фоновая задача не запускается в тестах, т.к. lifespan/`app.state.bot` не активны).

- [ ] **Step 4: Commit**

```bash
git add backend/app/features/auth/router.py
git commit -m "feat(tg-users): schedule avatar refresh after telegram login"
```

---

## Task 5: OwnerOut + _owner_out(shop) + батч магазинов

**Files:**
- Modify: `backend/app/features/admin/schemas.py`
- Modify: `backend/app/features/admin/router.py`
- Test: дополнить `backend/tests/integration/test_admin.py`

- [ ] **Step 1: Написать failing API-тест**

Добавить в `backend/tests/integration/test_admin.py` (внизу файла; фикстура
`admin` уже есть в этом файле, `admin_client`/`db` — из conftest):

```python
async def test_users_list_exposes_client_status_and_avatar(admin_client, db):
    from app.features.auth.models import User
    from app.features.shops.models import Shop

    # user with a paid (basic) shop → "client"
    u = User(full_name="Paid Owner", tg_id=810001)
    db.add(u)
    await db.flush()
    shop = Shop(name="PaidShop", language_default="ru", owner_id=u.id, plan="basic")
    db.add(shop)
    await db.flush()
    u.shop_id = shop.id
    # user without a shop → "no_shop"
    db.add(User(full_name="Orphan", tg_id=810002))
    await db.commit()

    r = await admin_client.get("/api/v1/admin/users")
    assert r.status_code == 200
    by_name = {row["full_name"]: row for row in r.json()["items"]}
    assert by_name["Paid Owner"]["client_status"] == "client"
    assert by_name["Orphan"]["client_status"] == "no_shop"
    assert "avatar_url" in by_name["Orphan"]
    assert by_name["Orphan"]["avatar_url"] is None
```

> Сверь обязательные поля `Shop` (open `app/features/shops/models.py`): если у
> `Shop` есть NOT NULL поля без default помимо `name`/`language_default`/
> `owner_id`/`plan` — добавь их в конструктор (напр. `plan_until`).

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_admin.py::test_users_list_exposes_client_status_and_avatar -v`
Expected: FAIL (KeyError client_status / поля нет).

- [ ] **Step 3: Поля в OwnerOut**

В `backend/app/features/admin/schemas.py`, в класс `OwnerOut`, после
`blocked_at: datetime | None`, добавить:

```python
    avatar_url: str | None
    client_status: str
```

- [ ] **Step 4: _owner_out принимает shop**

В `backend/app/features/admin/router.py`:

1. В импорты добавить (если ещё нет):
```python
from app.common import storage
from app.common.dates import today_tashkent
from app.features.shops.models import Shop
```
(`Shop` уже может быть импортирован — не дублируй.)

2. Заменить функцию `_owner_out`:
```python
def _owner_out(user: User, shop: Shop | None = None) -> OwnerOut:
    return OwnerOut.model_validate(
        {
            "id": user.id,
            "tg_id": user.tg_id,
            "tg_username": user.tg_username,
            "full_name": user.full_name,
            "phone": user.phone,
            "login": user.login,
            "has_password": user.password_hash is not None,
            "last_login_at": user.last_login_at,
            "last_login_source": user.last_login_source,
            "created_at": user.created_at,
            "is_blocked": user.is_blocked,
            "blocked_at": user.blocked_at,
            "avatar_url": (
                storage.presigned_url(user.avatar_key) if user.avatar_key else None
            ),
            "client_status": service.client_status(shop, today_tashkent()),
        }
    )
```

- [ ] **Step 5: Батч магазинов в list_users**

В `backend/app/features/admin/router.py`, в `list_users`, заменить финал
(блок `items = ...` + `return Page.of(...)`) на:

```python
    items = (
        await db.execute(
            base.order_by(User.created_at.desc())
            .limit(params.limit)
            .offset(params.offset)
        )
    ).scalars().all()

    shop_ids = {u.shop_id for u in items if u.shop_id is not None}
    shop_map: dict[int, Shop] = {}
    if shop_ids:
        shops = (
            await db.execute(select(Shop).where(Shop.id.in_(shop_ids)))
        ).scalars().all()
        shop_map = {s.id: s for s in shops}

    return Page.of(
        items=[_owner_out(u, shop_map.get(u.shop_id)) for u in items],
        total=int(total),
        params=params,
    )
```

> `select` и `Shop` уже доступны в файле (используются в других местах). Если
> `Shop` не импортирован — добавь импорт из шага 4.

- [ ] **Step 6: get_user передаёт shop**

В `backend/app/features/admin/router.py`, в `get_user`, заменить тело:

```python
async def get_user(
    user_id: int, admin: CurrentAdmin, db: DbSession
) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    shop = (
        await shop_repo.get_by_id(db, user.shop_id)
        if user.shop_id is not None
        else None
    )
    return _owner_out(user, shop)
```

- [ ] **Step 7: Обновить остальные вызовы _owner_out**

В `backend/app/features/admin/router.py`:
- В `_shop_admin_out` (строит owner): заменить `_owner_out(owner)` на
  `_owner_out(owner, shop)` (там `shop` уже в области видимости).
- В `set_owner_credentials`: заменить `return _owner_out(owner)` на
  `return _owner_out(owner, shop)` (там `shop` уже загружен выше).

> Найди все вызовы: `grep -n "_owner_out(" app/features/admin/router.py` — у
> каждого, где есть `shop`, передай его; где shop недоступен и не грузится
> дёшево, оставь `_owner_out(user)` (статус будет считаться от None — но такие
> места строят owner магазина, где shop ЕСТЬ).

- [ ] **Step 8: Запустить тест — пройдёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_admin.py -q`
Expected: новый тест PASS, прежние admin-тесты не сломаны.

- [ ] **Step 9: Commit**

```bash
git add backend/app/features/admin/schemas.py backend/app/features/admin/router.py backend/tests/integration/test_admin.py
git commit -m "feat(tg-users): expose avatar_url + client_status in /admin/users (batch shops)"
```

---

## Task 6: Фронт — аватар, t.me, бейдж статуса

**Files:**
- Modify: `admin/src/types.ts`
- Modify: `admin/src/pages/Users.tsx`
- Modify: `admin/src/i18n/ru.json`, `admin/src/i18n/uz.json`

- [ ] **Step 1: Тип OwnerOut**

В `admin/src/types.ts`, в `interface OwnerOut`, после `blocked_at: string | null;`
добавить:
```ts
  avatar_url: string | null;
  client_status: string;
```

- [ ] **Step 2: Аватар + t.me + бейдж в Users.tsx**

В `admin/src/pages/Users.tsx`:

1. Карта статуса (рядом с `SOURCE_ICONS`, до компонента):
```tsx
const STATUS_CLS: Record<string, string> = {
  client: 'bg-success/15 text-success',
  trial: 'bg-accent/15 text-accent',
  expired: 'bg-warning/15 text-warning',
  frozen: 'bg-danger-faded text-danger',
  no_shop: 'bg-bg3 text-text-muted',
};
```

2. Заменить блок инициалов аватара (`<div className="flex h-9 w-9 ...">{initials}</div>`)
   на условный рендер реального фото с fallback:
```tsx
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-faded text-caption font-bold uppercase text-accent">
                          {u.full_name
                            .split(' ')
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')}
                        </div>
                      )}
```

3. Сделать `@username` ссылкой — заменить
   `<span className="block truncate text-accent">@{u.tg_username}</span>` на:
```tsx
                        <a
                          href={`https://t.me/${u.tg_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-accent hover:underline"
                        >
                          @{u.tg_username}
                        </a>
```

4. Добавить бейдж статуса в ячейку статуса (рядом с блок-бейджем, в той же
   `<div className="flex items-center justify-end gap-2">`, ПЕРЕД блок-бейджем):
```tsx
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-micro font-semibold',
                          STATUS_CLS[u.client_status] ?? STATUS_CLS.no_shop,
                        )}
                      >
                        {t(`users.status_${u.client_status}`)}
                      </span>
```

> `cn` уже импортирован в Users.tsx. Сверь, что ячейка статуса (добавленная в
> фиче блокировки) — это последняя `<div className="flex items-center justify-end gap-2">`.

- [ ] **Step 3: i18n-ключи**

В `admin/src/i18n/ru.json`, в объект `"users"`, добавить:
```json
    "status_client": "Клиент",
    "status_trial": "Триал",
    "status_expired": "Истёк",
    "status_frozen": "Заморожен",
    "status_no_shop": "Без магазина"
```

В `admin/src/i18n/uz.json`, в объект `"users"`, добавить:
```json
    "status_client": "Mijoz",
    "status_trial": "Sinov",
    "status_expired": "Muddati tugagan",
    "status_frozen": "Muzlatilgan",
    "status_no_shop": "Do'konsiz"
```

- [ ] **Step 4: Сборка**

Run: `cd admin && pnpm build`
Expected: `built` без ошибок TypeScript.

- [ ] **Step 5: Commit**

```bash
git add admin/src/types.ts admin/src/pages/Users.tsx admin/src/i18n/ru.json admin/src/i18n/uz.json
git commit -m "feat(admin): real avatars, t.me links, client-status badge on Users page"
```

---

## Task 7: Полная верификация

- [ ] **Step 1: Backend — все тесты**

Run:
```bash
docker compose up -d postgres minio
cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" \
  REDIS_URL="redis://localhost:6379/15" uv run pytest -q
```
Expected: все PASS (прежние + новые: client_status×5, avatars×3, users-list×1).

- [ ] **Step 2: Сборка админки**

Run: `cd admin && pnpm build`
Expected: OK.

- [ ] **Step 3: Финальный commit (если остались мелочи)**

```bash
git add -A && git commit -m "chore(tg-users): final wiring & verification"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеца:** поля+миграция (T1), client_status (T2), avatar-сервис (T3),
  запуск на входе (T4), схема+endpoint+батч (T5), фронт аватар/t.me/бейдж (T6),
  верификация (T7). ✓
- **Типы/имена согласованы:** `avatar_key`/`avatar_fetched_at` (модель→сервис),
  `refresh_avatar`/`refresh_avatar_bg`, `client_status(shop, today)`,
  `OwnerOut.avatar_url`/`client_status`, `_owner_out(user, shop)`,
  ключи `users.status_*`, статусы `no_shop/trial/client/expired/frozen`. ✓
- **Плейсхолдеров нет:** есть явные «сверь имя X в Y» — проверки точек интеграции
  (logger, поля Shop, импорт Shop, вызовы _owner_out), не TODO в коде.

## Точки интеграции — свериться перед началом
1. Импорт `Text` в `auth/models.py`.
2. down_revision `0020` = `0019_add_user_is_blocked`.
3. `logger` — `app/core/logging.py`.
4. aiogram: `get_user_profile_photos(user_id, limit=)`, `get_file`, `download_file`.
5. `app.state.bot` — `app/main.py` lifespan.
6. `storage.upload`/`presigned_url`, bucket — `app/common/storage.py`.
7. Все вызовы `_owner_out(` — `app/features/admin/router.py`.
8. Обязательные поля `Shop` для тест-конструктора — `app/features/shops/models.py`.
