# Owner Contact (editable phone + admin note) — Design Spec

**Дата:** 2026-06-13
**Статус:** утверждён (брейншторм), готов к плану.

## Контекст и цель

Платформа закрытая: тенантов (магазин + владелец) заводит только платформенный
админ. Владелец может работать **без Telegram** (логин/пароль). Сейчас после
создания контакты владельца (телефон/Telegram) **нельзя редактировать**, и нет
поля для произвольной контактной заметки — особенно болезненно для не-Telegram
клиентов, до которых иначе не достучаться.

**Цель:** дать платформенному админу **редактируемый блок контактов владельца**:
- сделать существующий `users.phone` редактируемым;
- добавить свободную заметку `users.admin_contact_note` (второй телефон, другой
  TG, «звонить вечером» и т.п.) — работает независимо от Telegram.

## Решения (брейншторм)
- Поле — свободный текст `admin_contact_note` + редактируемый `phone`.
- Редактирование — на **ShopDetail** (карточка владельца, действие «Контакты»).
- Отображение заметки — также на странице «Пользователи» (под контактом).
- Сбор телефонов через `requestContact` — НЕ делаем (вне scope).

## Архитектура

### 1. Данные — миграция `0021`
В `users` добавить:
- `admin_contact_note: str | None` (`Text`, nullable) — заметка платформенного
  админа о том, как связаться с владельцем.

(`phone` уже есть — новое поле не требуется, только редактирование.)

### 2. Схема
`OwnerOut` (`app/features/admin/schemas.py`) += `admin_contact_note: str | None`.
`_owner_out` (`app/features/admin/router.py`) добавляет ключ
`"admin_contact_note": user.admin_contact_note`.

Новая входная схема `ContactUpdate` (`app/features/admin/schemas.py`):
```python
class ContactUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=32)
    admin_contact_note: str | None = Field(default=None, max_length=2000)
```

### 3. Эндпоинт
`PATCH /api/v1/admin/users/{user_id}/contact` (под `CurrentAdmin`):
- 404 если пользователь не найден.
- Обновляет `user.phone` и `user.admin_contact_note` из тела (оба
  опциональны; присланные значения перезаписывают, включая `null` для очистки).
- Возвращает `OwnerOut` (с подгруженным магазином для `client_status`, как в
  block/unblock).

Сервис `app/features/admin/service.py::update_contact(user, phone, note)` —
тонкая функция-сеттер (симметрично block_user/unblock_user), тестируемая.

> Семантика «оба опциональны»: PATCH присылает только изменённые поля? Для
> простоты UI шлёт оба поля целиком (значения из формы), поэтому сеттер
> присваивает оба напрямую. (Не делаем partial-merge — YAGNI.)

### 4. Фронт
**Тип** `OwnerOut` (`admin/src/types.ts`) += `admin_contact_note: string | null`.

**API** (`admin/src/api/index.ts`):
```ts
export const updateUserContact = (id, data: {phone: string|null; admin_contact_note: string|null}) =>
  api.patch<OwnerOut>(`/users/${id}/contact`, data).then(r => r.data);
```

**ShopDetail** (`admin/src/pages/ShopDetail.tsx`): в карточке владельца —
- показать `admin_contact_note` (если есть);
- кнопка «Контакты» → модалка (как существующие credsModal/freeze): поля
  «Телефон» + «Заметка» (textarea), предзаполнены текущими значениями →
  `updateUserContact(owner.id, …)` → инвалидация запроса магазина + toast.

**Users** (`admin/src/pages/Users.tsx`): под телефоном в ячейке «Контакт»
показать `admin_contact_note` маленьким приглушённым текстом (если есть). Без
редактирования здесь (правка — на ShopDetail).

i18n RU/UZ: `users.contact_note`, `shopDetail.edit_contact`, `shopDetail.phone`,
`shopDetail.note`, тосты.

## Поток данных
1. Админ на ShopDetail жмёт «Контакты» → модалка с телефоном/заметкой → PATCH →
   `user.phone`/`admin_contact_note` обновлены → карточка/список перечитываются.
2. На «Пользователи» заметка видна под телефоном.

## Обработка ошибок
- 404 на несуществующего пользователя.
- Пустые строки трактуем как очистку (шлём `null`, если поле пустое — решает
  фронт: пустой input → `null`).

## Тестирование
- **integration** `test_owner_contact.py` (admin_client): PATCH
  `/users/{id}/contact` с `{phone, admin_contact_note}` → 200, поля обновлены в
  ответе; повторный PATCH с `null` очищает; 404 на неизвестного id.
- Существующие admin-тесты не должны сломаться (OwnerOut += поле).

## Вне scope
- `requestContact`-флоу сбора телефонов.
- Структурированные мультиконтакты, история обращений, email.
- Редактирование Telegram-полей (tg_id/username).

## Точки интеграции — свериться при реализации
1. `User` модель + импорт `Text` (уже есть после фичи аватаров) —
   `app/features/auth/models.py`.
2. down_revision `0021` = `0020_add_user_avatar`.
3. `_owner_out` и его вызовы — `app/features/admin/router.py` (уже принимает shop).
4. Паттерн модалок ShopDetail (credsModal/freeze) — `admin/src/pages/ShopDetail.tsx`.
5. Тест-фикстуры `admin_client`/`db` — `backend/tests/conftest.py`.
