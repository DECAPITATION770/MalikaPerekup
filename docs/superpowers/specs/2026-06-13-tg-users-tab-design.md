# Telegram-Users Tab (step 2) — Design Spec

> Подсистема 2 из ROADMAP, шаг 2. Шаг 1 (блокировка) уже в main.

**Дата:** 2026-06-13
**Статус:** утверждён (брейншторм), готов к плану.

## Цель

Обогатить админскую страницу «Пользователи» (перекупщики = `users`) реальными
аватарами из Telegram, кликабельными ссылками `t.me/<username>` и подробным
статусом «клиент» (из плана магазина). Сбор телефонов (`requestContact`) — вне
scope этой итерации.

## Решения (брейншторм)
- **Расширяем существующую страницу «Пользователи»**, отдельную вкладку-роут не
  добавляем (DRY — страница уже листит всех пользователей с поиском).
- **Аватары** обновляются **при входе через Telegram** (fire-and-forget фоновая
  задача), хранятся в MinIO (private), отдаются в админку через presigned URL.
  Рефреш не чаще раза в 7 дней; нет фото / приватность → fallback на инициалы.
- **Статус «клиент»** — подробный бейдж из 5 состояний.
- Телефон показываем существующий (`users.phone`), без флоу сбора.

## Архитектура

### 1. Данные — миграция `0020`
В `users`:
- `avatar_key: str | None` (`Text`, nullable) — ключ объекта в MinIO
  (`avatars/{user_id}.jpg`), либо null.
- `avatar_fetched_at: datetime | None` (`DateTime(timezone=True)`, nullable) —
  когда последний раз пытались получить фото (для троттлинга рефреша и чтобы не
  дёргать Telegram повторно при скрытом фото).

Модель — `app/features/auth/models.py::User`.

### 2. Аватары — `app/features/auth/avatars.py` (новый модуль)
```
async def refresh_avatar(bot, db, user) -> None
```
Логика:
- Если `user.tg_id is None` → выход.
- Если `avatar_fetched_at` свежее 7 дней → выход (троттлинг).
- `photos = await bot.get_user_profile_photos(user.tg_id, limit=1)`.
- Нет фото (`total_count == 0`) → выставить `avatar_fetched_at = now_utc()`,
  commit, выход (инициалы как fallback на фронте).
- Иначе: взять самый крупный размер `photos.photos[0][-1].file_id` →
  `file = await bot.get_file(file_id)` → `buf = await bot.download_file(file.file_path)`
  → `storage.upload(f"avatars/{user.id}.jpg", buf.read(), "image/jpeg")` →
  `user.avatar_key = key; user.avatar_fetched_at = now_utc()` → commit.

Фоновая обёртка (своя сессия, т.к. сессия запроса уже закрыта):
```
async def refresh_avatar_bg(user_id: int, bot) -> None:
    async with SessionFactory() as db:
        user = await user_repo.get_by_id(db, user_id)
        if user is not None:
            await refresh_avatar(bot, db, user)
```

Изоляция: `refresh_avatar` зависит только от объекта `bot` с методами
`get_user_profile_photos` / `get_file` / `download_file` (aiogram 3.x ≥ 3.13) —
в тестах бот мокается фейком.

### 3. Запуск рефреша на входе
В `app/features/auth/router.py::login_via_telegram` добавить параметры
`request: Request` и `background_tasks: BackgroundTasks`. После успешного
получения `(user, token)`:
```
bot = getattr(request.app.state, "bot", None)
if bot is not None:
    background_tasks.add_task(avatars.refresh_avatar_bg, user.id, bot)
```
`app.state.bot` уже выставляется в lifespan (`app/main.py`). Ошибки фоновой
задачи не влияют на ответ логина (fire-and-forget).

### 4. Статус «клиент» — чистая функция в `app/features/admin/service.py`
```
def client_status(shop, today) -> str:
    if shop is None:           return "no_shop"
    if shop.is_frozen:         return "frozen"
    if shop.plan_until is not None and shop.plan_until < today:
                               return "expired"
    if shop.plan == "basic":   return "client"
    return "trial"
```
Приоритет: нет магазина → заморожен → истёк → платный(basic)=клиент → триал.

### 5. Схема и сборка ответа
`OwnerOut` (`app/features/admin/schemas.py`) += :
- `avatar_url: str | None`
- `client_status: str`

`_owner_out` (`app/features/admin/router.py`) получает магазин для статуса:
```
def _owner_out(user: User, shop: Shop | None = None) -> OwnerOut:
    ... existing fields ...
    "avatar_url": (storage.presigned_url(user.avatar_key) if user.avatar_key else None),
    "client_status": service.client_status(shop, today_tashkent()),
```
Обновить всех вызывающих, чтобы передавали магазин, где он есть:
- `list_users`: после выборки `items` собрать `shop_id`-ы, одним запросом
  `select(Shop).where(Shop.id.in_(ids))` построить map, вызвать
  `_owner_out(u, shop_map.get(u.shop_id))` (без N+1).
- `get_user`: `shop = await shop_repo.get_by_id(db, user.shop_id) if user.shop_id else None`.
- `_shop_admin_out`: уже держит `shop` → `_owner_out(owner, shop)`.
- `set_owner_credentials`: уже загружает `shop` → `_owner_out(owner, shop)`.

> `today_tashkent` импортируется из `app.common.dates`; `storage` —
> `app.common.storage`; `Shop` уже импортирован в admin/router.

### 6. Фронт — `admin/src/pages/Users.tsx`
- Тип `OwnerOut` (`admin/src/types.ts`) += `avatar_url: string | null`,
  `client_status: string`.
- Аватар-ячейка: если `avatar_url` → `<img>` (круглый, object-cover, `loading="lazy"`,
  `onError` → скрыть и показать инициалы); иначе текущие инициалы.
- `@username` → `<a href="https://t.me/{username}" target="_blank" rel="noopener">`.
- Новая колонка «Клиент»: цветной бейдж по `client_status`
  (no_shop/trial/client/expired/frozen) — карта цветов в компоненте.
- i18n `users.status_*` в `admin/src/i18n/{ru,uz}.json`.

## Поток данных
1. Перекупщик входит через Telegram → токен выдан → фоновая задача тянет фото в
   MinIO, пишет `avatar_key`.
2. Админ открывает «Пользователи» → `GET /admin/users` отдаёт `avatar_url`
   (presigned) + `client_status` (из магазина) → таблица с фото, t.me, статусом.

## Обработка ошибок
- Фоновая задача аватара глотает ошибки (логирует), не влияет на логин.
- Скрытое фото / нет фото → `avatar_key=null` → инициалы.
- presigned URL живёт ≤ 15 мин (клампится в storage) — админка перезапрашивает
  список по необходимости (TanStack staleTime).

## Тестирование
- **unit** `test_client_status.py`: 5 случаев (no_shop/frozen/expired/client/trial),
  включая приоритет frozen над expired и basic+expired.
- **integration** `test_avatars.py` (реальный MinIO):
  - фейковый бот возвращает 1 фото (bytes) → `refresh_avatar` кладёт объект в
    MinIO по ключу `avatars/{id}.jpg` и пишет `avatar_key`+`avatar_fetched_at`.
  - фейковый бот с `total_count=0` → `avatar_key` остаётся null,
    `avatar_fetched_at` выставлен.
  - троттлинг: если `avatar_fetched_at` свежее 7 дней → бот не вызывается.
- **integration** `test_admin.py`/новый: `GET /admin/users` (admin_client) для
  пользователя с магазином `basic` → `client_status=="client"`; без магазина →
  `"no_shop"`; поле `avatar_url` присутствует (null без фото).

## Вне scope
- Сбор телефонов (`requestContact`).
- Отдельный пункт меню/роут «Telegram-пользователи».
- Аватары контрагентов (это покупатели/продавцы, другая сущность).

## Точки интеграции — свериться при реализации
1. `User` модель + импорты — `app/features/auth/models.py`.
2. down_revision `0020` = `0019_add_user_is_blocked`.
3. aiogram API: `bot.get_user_profile_photos(user_id, limit=)`,
   `bot.get_file(file_id)`, `bot.download_file(file_path)` (aiogram 3.13+).
4. `app.state.bot` — выставляется в `app/main.py` lifespan.
5. `storage.upload(key, data, content_type)` / `storage.presigned_url(key)` —
   `app/common/storage.py`.
6. `_owner_out` и все его вызовы — `app/features/admin/router.py`.
7. `today_tashkent` — `app/common/dates.py`.
8. Тест-фикстуры `db`/`client`/`admin_client`, MinIO bucket `malika-test`.
