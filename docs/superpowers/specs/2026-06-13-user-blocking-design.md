# User Blocking — Design Spec

> Подсистема 2 из ROADMAP, шаг 1 (quick-win). Полная вкладка «Telegram-пользователи»
> (аватары/телефоны/статус «клиент») — отдельным циклом позже.

**Дата:** 2026-06-13
**Статус:** утверждён (брейншторм), готов к написанию плана.

## Цель

Platform-admin может **немедленно** заблокировать Telegram-доступ (Mini App /
`initData`) конкретному пользователю, **не затрагивая** его резервный вход по
логину/паролю. Это «мягкая» блокировка именно Telegram-поверхности — тоньше, чем
существующая заморозка магазина (`shop.is_frozen`, которая рубит все пути входа
для всех пользователей магазина на уровне `get_current_shop`).

### Чем отличается от заморозки магазина
| | Заморозка магазина | Блокировка пользователя (эта фича) |
|---|---|---|
| Уровень | магазин (все его юзеры) | один пользователь |
| Пути входа | все (initData + логин/пароль) | только Telegram/initData |
| Точка enforce | `get_current_shop` (бизнес-эндпоинты) | `get_current_user` + `/auth/telegram` |
| Код ответа | 403 `{"code":"shop_frozen"}` | 403 `{"code":"user_blocked"}` |

## Решения (из брейншторма)
- Блокирует **platform-admin** (не владелец магазина), на существующей странице
  админки «Пользователи».
- Логин/пароль у заблокированного **остаётся рабочим** (намеренно).
- Эффект **немедленный** — гард на каждом запросе для Telegram-сессий, а не
  только на новом входе.
- Минимализм: `is_blocked` + `blocked_at` (без причины-текста — добавим позже,
  если понадобится).

## Архитектура

### 1. Данные — миграция `0019`
Добавить в `users`:
- `is_blocked: bool` — `nullable=False, default=False, server_default='false'`.
- `blocked_at: datetime|None` (`DateTime(timezone=True)`, nullable) — для отображения
  «когда заблокирован» в админке; ставится в момент блокировки, обнуляется при
  разблокировке.

Модель — `app/features/auth/models.py::User` (тот же стиль, что у соседних полей,
`now_utc`-таймстемпы). Зарегистрировать в conftest уже не нужно (User уже там).

### 2. Метка источника входа в JWT
Сейчас токен несёт только `sub`/`iat`/`exp` и не различает путь входа.
`create_access_token(user_id, extra=...)` уже мёрджит `extra` в payload, поэтому:
- `auth/service.login_via_telegram` → `create_access_token(user.id, extra={"src": "telegram"})`
- `auth/service.login_via_password` → `create_access_token(user.id, extra={"src": "login"})`

Правило гарда: **блокируем только при `src == "telegram"`**. Отсутствие `src`
(токены, выданные до деплоя) трактуется как «не telegram» → пропускается. Это
безопасно: `is_blocked` — новое поле (по умолчанию false), на момент деплоя никто
не заблокирован; к моменту реальной блокировки пользователю уже выдаются токены с
`src`. Худший случай — заблокированный с pre-deploy токеном остаётся доступен до
истечения токена (≤ `JWT_TTL_HOURS`), что приемлемо и не ломает парольные сессии.

### 3. Точки enforce
- **`app/core/deps.py::get_current_user`** — общий choke-point для `CurrentUser` и
  (через него) `CurrentShop`. После загрузки `User`: если `user.is_blocked` **и**
  `src == "telegram"` → `HTTPException(403, {"code": "user_blocked"})`.
  Чтобы узнать `src`, нужен доступ к payload токена. Вводим тонкую зависимость
  `get_token_src` (декодит токен, возвращает `payload.get("src")`; при dev-bypass /
  отсутствии токена → `None`). `get_current_user` зависит от неё. Двойной decode
  HS256 дёшев; альтернатива (рефактор `get_current_user_id` в `get_token_payload`)
  — на усмотрение плана, но не обязательна.
  > dev-bypass (`get_current_user_id` без токена) → `src=None` → не блокируется
  > (только dev).
- **`POST /auth/telegram`** (`auth/router` + `auth/service.login_via_telegram`):
  если найденный пользователь `is_blocked` → 403 `{"code":"user_blocked"}`,
  токен НЕ выдаём, и пишем `AccessAttempt(source="telegram", success=False,
  reason="blocked", identifier=tg_id, user_id=user.id)` — консистентно с текущим
  аудитом входов.
- **Логин/пароль** (`src="login"`) — гард игнорирует, доступ сохраняется.

### 4. Admin API (под `CurrentAdmin`, в `app/features/admin/`)
- `POST /api/v1/admin/users/{id}/block` → `is_blocked=True`, `blocked_at=now_utc()`.
- `POST /api/v1/admin/users/{id}/unblock` → `is_blocked=False`, `blocked_at=None`.
- Оба возвращают обновлённого пользователя; 404 если пользователь не найден.
- Существующий список `GET /users` и его схема (`OwnerOut` / схема users-роутера
  админки) → добавить поля `is_blocked`, `blocked_at`.

### 5. Admin UI (`admin/src/pages/Users.tsx`)
- Бейдж «Заблокирован» в строке заблокированного пользователя.
- Кнопка блок/разблок в строке (или в меню строки): блокировка — через
  диалог-подтверждение; разблокировка — сразу.
- API-функции в `admin/src/api/index.ts`: `blockUser(id)`, `unblockUser(id)`,
  тип `OwnerOut` дополнить `is_blocked`/`blocked_at`. После мутации —
  инвалидация запроса `['users', ...]`.
- i18n-ключи `users.*` в `admin/src/i18n/{ru,uz}.json` (бейдж, кнопки, диалог).

## Поток данных
1. Admin жмёт «Заблокировать» → `POST /admin/users/{id}/block` → `is_blocked=true`.
2. У пользователя при следующем запросе из Mini App `get_current_user` видит
   `is_blocked && src=="telegram"` → 403 `user_blocked` → фронт тенанта показывает
   экран блокировки (повторно использовать паттерн `shop_frozen`, если есть).
3. Тот же пользователь через логин/пароль (`src="login"`) заходит нормально.
4. Admin жмёт «Разблокировать» → доступ через Telegram восстановлен.

## Обработка ошибок
- Блокировка несуществующего пользователя → 404.
- Гард возвращает структурированный `{"code":"user_blocked"}` (как `shop_frozen`),
  чтобы фронт отличал его от обычного 401/403.
- Идемпотентность: повторный block/unblock не ошибка (просто выставляет состояние).

## Тестирование (pytest, реальный Postgres)
- `test_blocked_user_telegram_session_403`: пользователь `is_blocked=True`, токен с
  `src="telegram"` → защищённый эндпоинт (`GET /auth/me` или любой `CurrentShop`) →
  403 `user_blocked`.
- `test_blocked_user_password_session_ok`: тот же пользователь, токен `src="login"`
  → 200.
- `test_unblock_restores_access`: после `/unblock` telegram-токен снова 200.
- `test_admin_block_unblock_endpoints`: admin-клиент block→200 (is_blocked true),
  unblock→200 (false); 404 на несуществующего.
- `test_login_via_telegram_blocked_403` (по возможности): заблокированный не
  получает токен через `/auth/telegram` (на уровне сервиса, чтобы не подделывать
  HMAC initData).
- Существующие тесты входа не должны сломаться от нового `src`-клейма.

## Вне scope (на будущее)
- Аватары, сбор телефонов (`requestContact`), статус «клиент», кликабельные t.me —
  это полноценная вкладка «Telegram-пользователи», отдельный цикл.
- Причина блокировки (текст), массовая блокировка, авто-разблокировка по времени.

## Точки интеграции (свериться при реализации)
1. `create_access_token(user_id, extra)` — `app/core/security.py` (мёрдж `extra` ✓).
2. `get_current_user` / `get_current_user_id` / `DbSession` — `app/core/deps.py`.
3. `login_via_telegram` / `login_via_password` — `app/features/auth/service.py`.
4. `AccessAttempt` поля — `app/features/admin/models.py`.
5. Admin users-роутер и схема `OwnerOut` — `app/features/admin/` + `admin/src/types.ts`.
6. Тест-фикстуры (`db`, `client`, `admin_client`) — `backend/tests/conftest.py`.
7. Down_revision для `0019` — шапка `0018_create_backup_tables.py`.
