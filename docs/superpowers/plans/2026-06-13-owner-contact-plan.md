# Owner Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Платформенный админ может редактировать телефон владельца и вести свободную контакт-заметку (`admin_contact_note`) — работает и для не-Telegram тенантов.

**Architecture:** Новое поле `users.admin_contact_note`. `PATCH /admin/users/{id}/contact` обновляет `phone` + заметку. Правка на ShopDetail (модалка как credsModal), показ заметки на Users.

**Tech Stack:** FastAPI, SQLAlchemy/Alembic, pytest, React+TS.

**Спец:** `docs/superpowers/specs/2026-06-13-owner-contact-design.md`.

**Тесты:** `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest`

---

## Task 1: Модель + миграция 0021

**Files:** Modify `backend/app/features/auth/models.py`; Create `backend/alembic/versions/0021_add_user_contact_note.py`

- [ ] **Step 1:** В `User` (после `avatar_fetched_at`) добавить:
```python
    admin_contact_note: Mapped[str | None] = mapped_column(Text, nullable=True)
```
(`Text` уже импортирован.)

- [ ] **Step 2:** Создать `0021_add_user_contact_note.py`:
```python
"""add users.admin_contact_note

Revision ID: 0021_add_user_contact_note
Revises: 0020_add_user_avatar
Create Date: 2026-06-13 14:00:00

Free-text admin contact note about a tenant owner (works for non-Telegram users).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_add_user_contact_note"
down_revision: str | None = "0020_add_user_avatar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("admin_contact_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "admin_contact_note")
```

- [ ] **Step 3:** Применить/обратить на dev:
```bash
cd backend && export DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika"
uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head
```
Expected: ok, колонка создаётся/удаляется.

- [ ] **Step 4:** Commit:
```bash
git add backend/app/features/auth/models.py backend/alembic/versions/0021_add_user_contact_note.py
git commit -m "feat(owner-contact): users.admin_contact_note (model + migration 0021)"
```

---

## Task 2: Backend — схема, сервис, эндпоинт

**Files:** Modify `backend/app/features/admin/schemas.py`, `backend/app/features/admin/service.py`, `backend/app/features/admin/router.py`; Create `backend/tests/integration/test_owner_contact.py`

- [ ] **Step 1: Failing-тест** — создать `backend/tests/integration/test_owner_contact.py`:
```python
import pytest

from app.features.auth.models import User


@pytest.mark.asyncio
async def test_update_contact(admin_client, db):
    u = User(full_name="Owner", tg_id=820001, phone="+998900000000")
    db.add(u)
    await db.commit()

    r = await admin_client.patch(
        f"/api/v1/admin/users/{u.id}/contact",
        json={"phone": "+998901112233", "admin_contact_note": "звонить вечером"},
    )
    assert r.status_code == 200
    assert r.json()["phone"] == "+998901112233"
    assert r.json()["admin_contact_note"] == "звонить вечером"

    cleared = await admin_client.patch(
        f"/api/v1/admin/users/{u.id}/contact",
        json={"phone": None, "admin_contact_note": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["phone"] is None
    assert cleared.json()["admin_contact_note"] is None

    missing = await admin_client.patch(
        "/api/v1/admin/users/999999/contact",
        json={"phone": None, "admin_contact_note": None},
    )
    assert missing.status_code == 404
```

- [ ] **Step 2: Запустить — упадёт**
Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_owner_contact.py -v`
Expected: FAIL (нет поля/эндпоинта).

- [ ] **Step 3: OwnerOut + ContactUpdate** — в `app/features/admin/schemas.py`:
В `OwnerOut` после `client_status: str` добавить:
```python
    admin_contact_note: str | None
```
И новую схему (рядом с другими Request-схемами; убедись что `Field` импортирован из pydantic — добавь к строке `from pydantic import ...`):
```python
class ContactUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=32)
    admin_contact_note: str | None = Field(default=None, max_length=2000)
```

- [ ] **Step 4: _owner_out + сервис** —
В `app/features/admin/router.py::_owner_out`, в словарь (после `"client_status": ...`) добавить:
```python
            "admin_contact_note": user.admin_contact_note,
```
В `app/features/admin/service.py` добавить:
```python
async def update_contact(user, phone, note) -> None:
    """Set the owner's phone + admin contact note (platform admin only)."""
    user.phone = phone
    user.admin_contact_note = note
```

- [ ] **Step 5: Эндпоинт** — в `app/features/admin/router.py`, рядом с block/unblock, добавить (импортировать `ContactUpdate` из schemas):
```python
@router.patch("/users/{user_id}/contact", response_model=OwnerOut)
async def update_user_contact(
    user_id: int, payload: ContactUpdate, admin: CurrentAdmin, db: DbSession
) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    await service.update_contact(user, payload.phone, payload.admin_contact_note)
    shop = (
        await shop_repo.get_by_id(db, user.shop_id)
        if user.shop_id is not None
        else None
    )
    return _owner_out(user, shop)
```
> Добавь `ContactUpdate` к существующему импорту схем admin в router.

- [ ] **Step 6: Запустить — пройдёт**
Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest tests/integration/test_owner_contact.py tests/integration/test_admin.py -q`
Expected: все PASS.

- [ ] **Step 7: Commit**
```bash
git add backend/app/features/admin/schemas.py backend/app/features/admin/service.py backend/app/features/admin/router.py backend/tests/integration/test_owner_contact.py
git commit -m "feat(owner-contact): PATCH /admin/users/{id}/contact + OwnerOut.admin_contact_note"
```

---

## Task 3: Фронт — ShopDetail модалка + Users показ

**Files:** Modify `admin/src/types.ts`, `admin/src/api/index.ts`, `admin/src/pages/ShopDetail.tsx`, `admin/src/pages/Users.tsx`, `admin/src/i18n/{ru,uz}.json`

- [ ] **Step 1: Тип** — в `admin/src/types.ts`, в `OwnerOut`, после `client_status: string;` добавить:
```ts
  admin_contact_note: string | null;
```

- [ ] **Step 2: API** — в `admin/src/api/index.ts` (секция Users) добавить:
```ts
export const updateUserContact = (
  id: number,
  data: { phone: string | null; admin_contact_note: string | null },
) => api.patch<OwnerOut>(`/users/${id}/contact`, data).then(r => r.data);
```

- [ ] **Step 3: ShopDetail модалка** — в `admin/src/pages/ShopDetail.tsx`:
1. Импорт `updateUserContact` (добавить к существующему импорту из `../api`).
2. Состояние (рядом с `credsModal`):
```tsx
  const [contactModal, setContactModal] = useState(false);
  const [cPhone, setCPhone] = useState('');
  const [cNote, setCNote] = useState('');
```
3. Мутация (рядом с credsMut):
```tsx
  const contactMut = useMutation({
    mutationFn: () =>
      updateUserContact(shop!.owner.id, {
        phone: cPhone.trim() || null,
        admin_contact_note: cNote.trim() || null,
      }),
    onSuccess: () => {
      setContactModal(false);
      qc.invalidateQueries({ queryKey: ['shop', shopId] });
      toast.success(t('shop_detail.toast_contact_saved'));
    },
    onError: () => toast.error(t('shop_detail.toast_contact_failed')),
  });
```
> Сверь имя query-key детали магазина (`['shop', shopId]`) и имя `qc`
> (useQueryClient) в файле — используй те же, что у credsMut/planMut.
4. В карточке владельца — показать заметку и кнопку. После строки
   `<Row label={t('shop_detail.phone')} value={shop.owner.phone} />` добавить:
```tsx
          <Row
            label={t('shop_detail.contact_note')}
            value={shop.owner.admin_contact_note}
          />
```
   И добавить кнопку «Контакты» рядом с кнопками действий владельца (там же,
   где «Set Creds») — открывает модалку, предзаполняя поля:
```tsx
              onClick={() => {
                setCPhone(shop.owner.phone ?? '');
                setCNote(shop.owner.admin_contact_note ?? '');
                setContactModal(true);
              }}
```
   (оформи как существующую кнопку «Set Creds»: тот же `Button`/иконка-стиль,
   текст `t('shop_detail.edit_contact')`.)
5. Модалка (рядом с credsModal `<Modal>`):
```tsx
      <Modal
        open={contactModal}
        onClose={() => setContactModal(false)}
        title={t('shop_detail.edit_contact')}
      >
        <div className="flex flex-col gap-3">
          <label className="text-caption font-medium text-text-dim">
            {t('shop_detail.phone')}
          </label>
          <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
          <label className="text-caption font-medium text-text-dim">
            {t('shop_detail.contact_note')}
          </label>
          <textarea
            className="min-h-20 rounded-lg border border-border bg-bg2 px-3 py-2 text-label text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            value={cNote}
            onChange={(e) => setCNote(e.target.value)}
          />
          <Button onClick={() => contactMut.mutate()} disabled={contactMut.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>
```
> Сверь проп-интерфейс `Modal` (open/onClose/title) и `Input` по образцу
> credsModal в этом же файле; повтори их форму.

- [ ] **Step 4: Users показ заметки** — в `admin/src/pages/Users.tsx`, в ячейке
  «Контакт» (где `{u.phone ?? '—'}`) добавить под телефоном:
```tsx
                    <div className="truncate font-mono text-label text-text-dim">
                      {u.phone ?? '—'}
                      {u.admin_contact_note && (
                        <span className="mt-0.5 block truncate font-sans text-caption text-text-muted">
                          {u.admin_contact_note}
                        </span>
                      )}
                    </div>
```
   (замени существующий одиночный `<div ...>{u.phone ?? '—'}</div>` на этот.)

- [ ] **Step 5: i18n** — в `admin/src/i18n/ru.json` в объект `shop_detail` добавить:
```json
    "edit_contact": "Контакты",
    "contact_note": "Заметка",
    "toast_contact_saved": "Контакты сохранены",
    "toast_contact_failed": "Не удалось сохранить контакты"
```
В `users` (ru.json) добавить: `"contact_note": "Заметка"` (если используешь ключ).
Аналогично в `uz.json` `shop_detail`:
```json
    "edit_contact": "Kontaktlar",
    "contact_note": "Eslatma",
    "toast_contact_saved": "Kontaktlar saqlandi",
    "toast_contact_failed": "Kontaktlarni saqlab bo'lmadi"
```
> Сверь, что в `shop_detail` есть ключ `phone` (используется в Row) — он уже
> должен быть. `common.save` тоже уже есть.

- [ ] **Step 6: Сборка**
Run: `cd admin && pnpm build`
Expected: `built` без ошибок TS.

- [ ] **Step 7: Commit**
```bash
git add admin/src/types.ts admin/src/api/index.ts admin/src/pages/ShopDetail.tsx admin/src/pages/Users.tsx admin/src/i18n/ru.json admin/src/i18n/uz.json
git commit -m "feat(admin): editable owner contact (phone + note) on ShopDetail; note on Users"
```

---

## Task 4: Верификация + перезапуск сервера

- [ ] **Step 1: Backend все тесты**
Run: `cd backend && DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" REDIS_URL="redis://localhost:6379/15" uv run pytest -q`
Expected: все PASS.

- [ ] **Step 2: Сборка админки** — `cd admin && pnpm build` → OK.

- [ ] **Step 3: Перезапустить контейнеры с новым кодом** (чтобы было видно в :8080):
```bash
docker compose up -d --build migrate backend admin
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok"}`; миграция 0021 применяется автоматически.

---

## Self-Review
- Покрытие спеца: поле+миграция (T1), схема/сервис/эндпоинт+тест (T2), фронт
  модалка+показ+i18n (T3), верификация+рестарт (T4). ✓
- Имена согласованы: `admin_contact_note`, `ContactUpdate`, `update_contact`,
  `updateUserContact`, `PATCH /users/{id}/contact`, ключи `shop_detail.edit_contact`. ✓
- Плейсхолдеров нет; «сверь X» — проверки точек интеграции (Modal/Input пропсы,
  query-key, наличие i18n-ключей).

## Точки интеграции
1. `Text` импорт в auth/models (есть). down_revision 0021=0020.
2. `Field` импорт в admin/schemas. `ContactUpdate` импорт в router.
3. `_owner_out(user, shop)` уже принимает shop. `shop_repo`/`user_repo` в router.
4. ShopDetail: `Modal`/`Input`/`Row`/`useQueryClient` qc/query-key `['shop', shopId]`.
5. i18n: наличие `shop_detail.phone`, `common.save`.
