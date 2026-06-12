# User Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platform-admin может немедленно заблокировать Telegram-доступ (Mini App / initData) конкретному пользователю, не затрагивая его вход по логину/паролю.

**Architecture:** Новое поле `users.is_blocked` (+`blocked_at`). JWT получает клейм `src` (`telegram`/`login`). Гард в `get_current_user` рубит сессии с `src=="telegram"` у заблокированного (403 `user_blocked`); `login_via_telegram` отказывает на входе. Логин/пароль (`src="login"`) не затрагивается. Admin блокирует/разблокирует на странице «Пользователи».

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, pytest (реальный Postgres), React 18 + Vite + TS (admin).

**Спецификация:** `docs/superpowers/specs/2026-06-13-user-blocking-design.md` — читать перед началом.

**Запуск тестов backend (порт 5433 занят чужим проектом — используем malika_test в malika_postgres):**
```bash
docker compose up -d postgres minio
cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" \
  REDIS_URL="redis://localhost:6379/15" uv run pytest
```

---

## File Structure

**Backend (модифицировать):**
- `backend/app/features/auth/models.py` — поля `is_blocked`, `blocked_at` в `User`.
- `backend/alembic/versions/0019_add_user_is_blocked.py` — новая ревизия (создать).
- `backend/app/features/auth/service.py` — клейм `src` в обоих логинах; `UserBlockedError` + блок-чек в `login_via_telegram`.
- `backend/app/core/deps.py` — зависимость `get_token_src` + блок-гард в `get_current_user`.
- `backend/app/features/auth/router.py` — маппинг `UserBlockedError` → 403.
- `backend/app/features/admin/service.py` — `block_user` / `unblock_user`.
- `backend/app/features/admin/router.py` — эндпоинты block/unblock; поля в `_owner_out`.
- `backend/app/features/admin/schemas.py` — `OwnerOut` += `is_blocked`, `blocked_at`.
- Тест: `backend/tests/integration/test_user_blocking.py` (создать).

**Frontend admin (модифицировать):**
- `admin/src/types.ts` — `OwnerOut` += `is_blocked`, `blocked_at`.
- `admin/src/api/index.ts` — `blockUser`, `unblockUser`.
- `admin/src/pages/Users.tsx` — бейдж + кнопка + диалог + мутации.
- `admin/src/i18n/{ru,uz}.json` — ключи `users.*`.

---

## Task 1: Модель + миграция

**Files:**
- Modify: `backend/app/features/auth/models.py`
- Create: `backend/alembic/versions/0019_add_user_is_blocked.py`

- [ ] **Step 1: Добавить поля в модель User**

В `backend/app/features/auth/models.py`, в класс `User`, сразу после блока «Login bookkeeping» (после `last_login_source`), добавить:

```python
    # ── Blocking (platform admin) ──
    # Soft block of the Telegram/initData surface only — login/password still
    # works. Enforced in get_current_user for telegram-src sessions.
    is_blocked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    blocked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

В импортах того же файла добавить `Boolean` к строке `from sqlalchemy import ...`:

```python
from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String
```

- [ ] **Step 2: Создать миграцию 0019**

Создать `backend/alembic/versions/0019_add_user_is_blocked.py`:

```python
"""add users.is_blocked and blocked_at

Revision ID: 0019_add_user_is_blocked
Revises: 0018_create_backup_tables
Create Date: 2026-06-13 10:00:00

Soft block of a user's Telegram/initData access (login/password unaffected).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_add_user_is_blocked"
down_revision: str | None = "0018_create_backup_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_blocked", sa.Boolean(), server_default="false", nullable=False
        ),
    )
    op.add_column(
        "users",
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "blocked_at")
    op.drop_column("users", "is_blocked")
```

- [ ] **Step 3: Применить и проверить обратимость (dev DB malika)**

Run:
```bash
cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika" \
  uv run alembic upgrade head && \
  DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika" \
  uv run alembic downgrade -1 && \
  DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika" \
  uv run alembic upgrade head
```
Expected: без ошибок; колонки `is_blocked`/`blocked_at` создаются и удаляются.

- [ ] **Step 4: Commit**

```bash
git add backend/app/features/auth/models.py backend/alembic/versions/0019_add_user_is_blocked.py
git commit -m "feat(blocking): users.is_blocked + blocked_at (model + migration 0019)"
```

---

## Task 2: Клейм `src` в JWT

**Files:**
- Modify: `backend/app/features/auth/service.py`
- Test: `backend/tests/integration/test_user_blocking.py` (создать)

- [ ] **Step 1: Написать failing-тест на клейм src**

Создать `backend/tests/integration/test_user_blocking.py`:

```python
import pytest

from app.core.security import create_access_token, decode_access_token
from app.features.auth.models import User


def test_token_carries_src_claim():
    token = create_access_token(1, extra={"src": "telegram"})
    payload = decode_access_token(token)
    assert payload["src"] == "telegram"


@pytest.mark.asyncio
async def test_password_login_token_has_login_src(db):
    from app.features.auth import service
    from app.core.security import hash_password

    user = User(full_name="Pass User", login="passuser",
                password_hash=hash_password("secret123"))
    db.add(user)
    await db.commit()

    _, token = await service.login_via_password(db, "passuser", "secret123")
    assert decode_access_token(token)["src"] == "login"
```

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -v`
Expected: `test_password_login_token_has_login_src` FAIL (нет `src`), первый тест PASS.

- [ ] **Step 3: Добавить src в оба логина**

В `backend/app/features/auth/service.py`:

В конце `login_via_telegram` заменить:
```python
    return user, create_access_token(user.id)
```
на:
```python
    return user, create_access_token(user.id, extra={"src": "telegram"})
```

В конце `login_via_password` (последняя строка функции) заменить:
```python
    return user, create_access_token(user.id)
```
на:
```python
    return user, create_access_token(user.id, extra={"src": "login"})
```

- [ ] **Step 4: Запустить — пройдёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -v`
Expected: оба PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/features/auth/service.py backend/tests/integration/test_user_blocking.py
git commit -m "feat(blocking): tag JWT with auth source (telegram/login)"
```

---

## Task 3: Request-гард в get_current_user

**Files:**
- Modify: `backend/app/core/deps.py`
- Test: `backend/tests/integration/test_user_blocking.py`

- [ ] **Step 1: Написать failing-тесты гарда**

Добавить в `backend/tests/integration/test_user_blocking.py`:

```python
@pytest.mark.asyncio
async def test_blocked_user_telegram_session_403(client, db):
    user = User(full_name="Blocked", tg_id=700001, is_blocked=True)
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, extra={"src": "telegram"})
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "user_blocked"


@pytest.mark.asyncio
async def test_blocked_user_password_session_ok(client, db):
    user = User(full_name="Blocked Pass", tg_id=700002, is_blocked=True)
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, extra={"src": "login"})
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_unblock_restores_telegram_access(client, db):
    user = User(full_name="Toggle", tg_id=700003, is_blocked=True)
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, extra={"src": "telegram"})
    blocked = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert blocked.status_code == 403

    user.is_blocked = False
    await db.commit()
    ok = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert ok.status_code == 200
```

- [ ] **Step 2: Запустить — упадут (нет гарда)**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -v`
Expected: три новых теста FAIL (возвращается 200 вместо 403).

- [ ] **Step 3: Добавить get_token_src + гард**

В `backend/app/core/deps.py`, после функции `get_current_user_id` (и до `CurrentUserId = ...` либо сразу после неё), добавить зависимость:

```python
async def get_token_src(
    authorization: Annotated[str | None, Header()] = None,
) -> str | None:
    """Return the ``src`` claim of the current JWT (``telegram``/``login``),
    or None when there's no/invalid token (e.g. dev bypass)."""
    settings = get_settings()
    if settings.dev_auth_bypass and settings.dev_bypass_user_id_int is not None:
        return None
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = decode_access_token(authorization.split(" ", 1)[1].strip())
    except InvalidToken:
        return None
    return payload.get("src")
```

Изменить сигнатуру и тело `get_current_user`:

```python
async def get_current_user(
    user_id: CurrentUserId,
    db: DbSession,
    token_src: Annotated[str | None, Depends(get_token_src)] = None,
):
    """Load the authenticated ``User`` row from the database."""
    from app.features.auth import repository as user_repo

    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    # Block applies to the Telegram/initData surface only; login/password
    # sessions (src == "login") are intentionally unaffected.
    if user.is_blocked and token_src == "telegram":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "user_blocked"},
        )
    return user
```

> `Annotated`, `Header`, `Depends`, `status`, `decode_access_token`, `InvalidToken`, `get_settings` уже импортированы в `deps.py` — проверь шапку, добавь недостающее только если линтер укажет.

- [ ] **Step 4: Запустить — пройдут**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -v`
Expected: все PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/deps.py backend/tests/integration/test_user_blocking.py
git commit -m "feat(blocking): reject blocked telegram sessions in get_current_user"
```

---

## Task 4: Отказ на входе через Telegram

**Files:**
- Modify: `backend/app/features/auth/service.py`
- Modify: `backend/app/features/auth/router.py`
- Test: `backend/tests/integration/test_user_blocking.py`

- [ ] **Step 1: Написать failing-тест входа заблокированного**

Добавить в `backend/tests/integration/test_user_blocking.py` (в начало файла — импорты):

```python
import hashlib
import hmac
import time
from urllib.parse import urlencode
```

И тест (использует подпись initData тем же секретом, что бот; `BOT_TOKEN` в conftest = `0:test-token`):

```python
def _signed_init_data(tg_id: int, bot_token: str = "0:test-token") -> str:
    user_json = f'{{"id":{tg_id},"first_name":"B"}}'
    fields = {"auth_date": str(int(time.time())), "user": user_json}
    data_check = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    sig = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return urlencode({**fields, "hash": sig})


@pytest.mark.asyncio
async def test_login_via_telegram_blocked(db):
    from app.features.auth import service

    user = User(full_name="Blocked TG", tg_id=700010, is_blocked=True)
    db.add(user)
    await db.commit()

    with pytest.raises(service.UserBlockedError):
        await service.login_via_telegram(db, _signed_init_data(700010))
```

> Если структура initData/секрет в проекте отличаются — сверься с
> `backend/tests/unit/test_telegram_initdata.py::_signed_init_data` и повтори
> ИХ способ подписи (это эталон).

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py::test_login_via_telegram_blocked -v`
Expected: FAIL (`UserBlockedError` не существует / не поднимается).

- [ ] **Step 3: Добавить UserBlockedError + блок-чек**

В `backend/app/features/auth/service.py` после класса `AuthError` добавить:

```python
class UserBlockedError(AuthError):
    """Telegram access blocked by platform admin (login/password still works)."""
```

В `login_via_telegram`, между проверкой `if user is None:` (после `raise AuthError("access denied …")`) и строкой `# Refresh username …`, вставить:

```python
    if user.is_blocked:
        await admin_service.log_attempt(
            db,
            source=AttemptSource.TELEGRAM,
            identifier=str(tg.id),
            tg_username=tg.username,
            success=False,
            reason="blocked",
            user_id=user.id,
        )
        raise UserBlockedError("access blocked by administrator")
```

- [ ] **Step 4: Маппинг в роутере на 403**

В `backend/app/features/auth/router.py`, в обработчике `login_via_telegram`, заменить блок:

```python
    try:
        user, token = await service.login_via_telegram(db, req.init_data)
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
```
на (UserBlockedError ловим РАНЬШЕ родительского AuthError):

```python
    try:
        user, token = await service.login_via_telegram(db, req.init_data)
    except service.UserBlockedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, {"code": "user_blocked"}
        ) from exc
    except service.AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
```

> Сверь точный текст существующего `except` (вызов `login_via_telegram`) и
> повтори его форму — выше показан ожидаемый вид.

- [ ] **Step 5: Запустить — пройдёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -v`
Expected: все PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/features/auth/service.py backend/app/features/auth/router.py backend/tests/integration/test_user_blocking.py
git commit -m "feat(blocking): deny blocked users at /auth/telegram (403 + audit)"
```

---

## Task 5: Admin API — block/unblock + схема

**Files:**
- Modify: `backend/app/features/admin/service.py`
- Modify: `backend/app/features/admin/router.py`
- Modify: `backend/app/features/admin/schemas.py`
- Test: `backend/tests/integration/test_user_blocking.py`

- [ ] **Step 1: Написать failing API-тест**

Добавить в `backend/tests/integration/test_user_blocking.py`:

```python
@pytest.mark.asyncio
async def test_admin_block_unblock(admin_client, db):
    user = User(full_name="Target", tg_id=700020)
    db.add(user)
    await db.commit()

    r = await admin_client.post(f"/api/v1/admin/users/{user.id}/block")
    assert r.status_code == 200
    assert r.json()["is_blocked"] is True
    assert r.json()["blocked_at"] is not None

    r2 = await admin_client.post(f"/api/v1/admin/users/{user.id}/unblock")
    assert r2.status_code == 200
    assert r2.json()["is_blocked"] is False
    assert r2.json()["blocked_at"] is None

    r3 = await admin_client.post("/api/v1/admin/users/999999/block")
    assert r3.status_code == 404
```

- [ ] **Step 2: Запустить — упадёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py::test_admin_block_unblock -v`
Expected: FAIL (404 — нет эндпоинтов, и/или KeyError `is_blocked` в ответе).

- [ ] **Step 3: Добавить поля в OwnerOut**

В `backend/app/features/admin/schemas.py`, в класс `OwnerOut` (после `created_at: datetime`), добавить:

```python
    is_blocked: bool
    blocked_at: datetime | None
```

В `backend/app/features/admin/router.py`, в функции `_owner_out`, добавить ключи в передаваемый словарь (после `"created_at": user.created_at,`):

```python
            "is_blocked": user.is_blocked,
            "blocked_at": user.blocked_at,
```

- [ ] **Step 4: Добавить service-функции**

В `backend/app/features/admin/service.py` добавить (рядом с прочими функциями, например после `log_attempt` / `register_shop_with_owner`):

```python
async def block_user(user) -> None:
    """Block the user's Telegram/initData access. Login/password unaffected."""
    from app.common.dates import now_utc

    user.is_blocked = True
    user.blocked_at = now_utc()


async def unblock_user(user) -> None:
    user.is_blocked = False
    user.blocked_at = None
```

> Если `now_utc` уже импортирован в шапке `service.py`, используй его без
> локального импорта.

- [ ] **Step 5: Добавить эндпоинты в admin router**

В `backend/app/features/admin/router.py`, рядом с `freeze_shop`/`unfreeze_shop`, добавить (mirror их стиля; `user_repo` уже импортирован — используется в `_shop_admin_out`):

```python
@router.post("/users/{user_id}/block", response_model=OwnerOut)
async def block_user(user_id: int, admin: CurrentAdmin, db: DbSession) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    await service.block_user(user)
    return _owner_out(user)


@router.post("/users/{user_id}/unblock", response_model=OwnerOut)
async def unblock_user(user_id: int, admin: CurrentAdmin, db: DbSession) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    await service.unblock_user(user)
    return _owner_out(user)
```

> `DbSession` коммитит в конце запроса (yield→commit), поэтому изменения
> сохраняются без явного `db.commit()` — как в `freeze_shop`.

- [ ] **Step 6: Запустить — пройдёт**

Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_user_blocking.py -v`
Expected: все PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/features/admin/service.py backend/app/features/admin/router.py backend/app/features/admin/schemas.py backend/tests/integration/test_user_blocking.py
git commit -m "feat(blocking): admin block/unblock endpoints + OwnerOut fields"
```

---

## Task 6: Admin UI

**Files:**
- Modify: `admin/src/types.ts`
- Modify: `admin/src/api/index.ts`
- Modify: `admin/src/pages/Users.tsx`
- Modify: `admin/src/i18n/ru.json`, `admin/src/i18n/uz.json`

- [ ] **Step 1: Тип OwnerOut**

В `admin/src/types.ts` найти `interface OwnerOut` (или тип, который отдаёт `/users`) и добавить поля:

```ts
  is_blocked: boolean;
  blocked_at: string | null;
```

> Если поле называется иначе (напр. `User`/`OwnerOut`) — добавь в тот тип,
> что использует `getUsers` (`Page<OwnerOut>` в `api/index.ts`).

- [ ] **Step 2: API-функции**

В `admin/src/api/index.ts`, в секции Users, добавить:

```ts
export const blockUser = (id: number) =>
  api.post<OwnerOut>(`/users/${id}/block`).then(r => r.data);

export const unblockUser = (id: number) =>
  api.post<OwnerOut>(`/users/${id}/unblock`).then(r => r.data);
```

> Базовый префикс axios — `/api/v1/admin`, поэтому путь `/users/${id}/block`.

- [ ] **Step 3: UI на странице Users**

В `admin/src/pages/Users.tsx`:

1. В импорты добавить мутации и хук:
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, ShieldCheck } from 'lucide-react';
import { getUsers, blockUser, unblockUser } from '../api';
```
(оставь существующий импорт `getUsers`; объедини, не дублируй.)

2. Внутри компонента, рядом с `useQuery`, добавить:
```tsx
  const qc = useQueryClient();
  const blockMut = useMutation({
    mutationFn: (id: number) => blockUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.blocked'));
    },
    onError: () => toast.error(t('users.block_error')),
  });
  const unblockMut = useMutation({
    mutationFn: (id: number) => unblockUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.unblocked'));
    },
    onError: () => toast.error(t('users.block_error')),
  });
```

3. Расширить грид строки: в шапке и в строках добавить колонку действий. Самый
   простой путь — поменять `grid-cols-[1fr_1fr_1fr_140px]` на
   `grid-cols-[1fr_1fr_1fr_140px_120px]` (в шапке и в строке) и добавить ячейку.
   В шапку после `{t('users.col_last_login')}`:
```tsx
              <span className="text-right">{t('users.col_status')}</span>
```
   В строке, после ячейки `last_login`, добавить:
```tsx
                    <div className="flex items-center justify-end gap-2">
                      {u.is_blocked && (
                        <span className="rounded bg-danger-faded px-1.5 py-0.5 text-micro font-semibold text-danger">
                          {t('users.blocked_badge')}
                        </span>
                      )}
                      {u.is_blocked ? (
                        <button
                          type="button"
                          title={t('users.unblock')}
                          className="text-text-dim hover:text-success disabled:opacity-40"
                          disabled={unblockMut.isPending}
                          onClick={() => unblockMut.mutate(u.id)}
                        >
                          <ShieldCheck size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={t('users.block')}
                          className="text-text-dim hover:text-danger disabled:opacity-40"
                          disabled={blockMut.isPending}
                          onClick={() => {
                            if (window.confirm(t('users.block_confirm'))) {
                              blockMut.mutate(u.id);
                            }
                          }}
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
```

> Сверь точное имя поля пользователя в строке (в существующем коде это `u`).
> Подтверди, что текущая сетка действительно `grid-cols-[1fr_1fr_1fr_140px]`
> (она используется и в шапке, и в строках — менять надо ОБА места).

- [ ] **Step 4: i18n-ключи**

В `admin/src/i18n/ru.json`, в объект `"users"`, добавить:
```json
    "col_status": "Статус",
    "blocked_badge": "Заблокирован",
    "block": "Заблокировать Telegram-вход",
    "unblock": "Разблокировать",
    "block_confirm": "Заблокировать вход через Telegram для этого пользователя? Вход по логину/паролю продолжит работать.",
    "blocked": "Пользователь заблокирован",
    "unblocked": "Пользователь разблокирован",
    "block_error": "Не удалось изменить статус блокировки"
```

В `admin/src/i18n/uz.json`, в объект `"users"`, добавить:
```json
    "col_status": "Holat",
    "blocked_badge": "Bloklangan",
    "block": "Telegram-kirishni bloklash",
    "unblock": "Blokdan chiqarish",
    "block_confirm": "Bu foydalanuvchi uchun Telegram orqali kirishni bloklaymizmi? Login/parol orqali kirish ishlashda davom etadi.",
    "blocked": "Foydalanuvchi bloklandi",
    "unblocked": "Foydalanuvchi blokdan chiqarildi",
    "block_error": "Blok holatini o'zgartirib bo'lmadi"
```

> Не дублируй существующие ключи `users.*` — добавляй только отсутствующие.

- [ ] **Step 5: Сборка админки**

Run: `cd admin && pnpm build`
Expected: `built` без ошибок TypeScript.

- [ ] **Step 6: Commit**

```bash
git add admin/src/types.ts admin/src/api/index.ts admin/src/pages/Users.tsx admin/src/i18n/ru.json admin/src/i18n/uz.json
git commit -m "feat(admin): block/unblock control + status badge on Users page"
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
Expected: все PASS (прежние + новые из `test_user_blocking.py`), без падений в соседних тестах входа.

- [ ] **Step 2: Сборка админки**

Run: `cd admin && pnpm build`
Expected: OK.

- [ ] **Step 3: Финальный commit (если остались мелочи)**

```bash
git add -A && git commit -m "chore(blocking): final wiring & verification"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеца:** модель+миграция (T1), src-клейм (T2), request-гард (T3),
  отказ на /auth/telegram + аудит (T4), admin API+схема (T5), admin UI+i18n (T6),
  верификация (T7). ✓
- **Типы/имена согласованы:** `is_blocked`/`blocked_at` (модель→схема→TS),
  `src` клейм (`telegram`/`login`), `UserBlockedError(AuthError)`,
  `get_token_src`, `block_user`/`unblock_user`, код ответа `{"code":"user_blocked"}`,
  пути `/admin/users/{id}/block|unblock`. ✓
- **Плейсхолдеров нет:** есть явные «сверь имя X в файле Y» — это проверки точек
  интеграции (имя типа OwnerOut в TS, форма except в auth/router, сетка грида),
  не TODO в коде.

## Точки интеграции — свериться перед началом

1. Импорты в `auth/models.py` (добавить `Boolean`).
2. down_revision `0019` = `0018_create_backup_tables` (шапка `0018_*`).
3. Шапка `deps.py` — наличие `Annotated`/`Header`/`Depends`/`status`/`decode_access_token`/`InvalidToken`/`get_settings`.
4. Точная форма `except` в `auth/router.py::login_via_telegram`.
5. `_owner_out` строит `OwnerOut.model_validate({...})` — добавить ключи в словарь.
6. Имя типа в `admin/src/types.ts`, который отдаёт `getUsers`.
7. Класс грид-строки в `Users.tsx` (`grid-cols-[1fr_1fr_1fr_140px]`) — менять шапку и строку.
8. Тест-фикстуры `db`/`client`/`admin_client` — `backend/tests/conftest.py`.
