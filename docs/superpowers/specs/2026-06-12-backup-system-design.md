# Design Spec — Система бэкапа (Malika Perekup)

**Дата:** 2026-06-12
**Статус:** утверждён, готов к плану реализации
**Подсистема 1 из 3** (декомпозиция большого запроса; см. раздел «Контекст и роадмап»).

---

## Контекст и роадмап

Пользователь запросил три независимые подсистемы. Делаем по очереди, каждая —
свой спец → план → реализация:

1. **Бэкап (этот документ)** — дамп БД + файлы object storage + восстановление,
   с расписанием, ретеншном, ручными операциями и доставкой в Telegram.
2. **Вкладка «Telegram-пользователи» + блокировка** — *не в этом спеце.* Список
   TG-юзеров (аватар, username, телефон где доступен, статус «клиент»,
   кликабельные юзернеймы) + блокировка, влияющая на вход через webapp/initData,
   но НЕ на вход по логину/паролю.
   ⚠️ Известное ограничение к проектированию: Telegram НЕ отдаёт телефон
   автоматически (только через явный `requestContact`); аватары — частично
   (`getUserProfilePhotos` / `photo_url` в initData).
3. **(Будущее)** прочее по мере появления.

Этот спец покрывает **только подсистему 1**.

---

## Цель

«Идеально скопировать проектную базу со всеми данными (аккаунты, магазины,
сделки, рассрочки, контрагенты) и файлами (документы/фото из object storage) в
один архив, и уметь восстановить обратно.» Плюс полная настройка: периодичность,
включение/отключение, ручная выгрузка/загрузка, доставка архива в Telegram и
авто-доставка после бэкапа.

### Критерии успеха

- Один артефакт `.tar.gz` содержит дамп БД + все объекты бакета + манифест.
- Восстановление из артефакта возвращает БД и бакет в точное состояние на момент
  бэкапа (проверяется интеграционным тестом: бэкап → мутация → restore → данные
  совпадают с исходными).
- Авто-бэкап по расписанию работает через существующий APScheduler; включение/
  отключение и периодичность меняются из админки без перезапуска.
- Старые бэкапы чистятся по `retention_count`.
- Доставка в Telegram: режим настраивается (полный / только БД / разбивка на
  части); части несут id+дату бэкапа и подпись «часть X/N».
- Все операции доступны только platform-admin.

---

## Архитектурные решения (зафиксированы при брейншторме)

| Решение | Выбор | Причина |
|---|---|---|
| Шифрование архива | **Нет** (plain `.tar.gz`) | Выбор пользователя. Архив с PII лежит на приватном volume; предупреждение в UI. |
| Язык реализации | **Python** | Стек проекта; переиспользуем `minio`-клиент и конфиг. |
| Дамп БД | `pg_dump -Fc` / `pg_restore` | Золотой стандарт; формат custom переносим и сжат. |
| Доступ к `pg_dump` | `postgresql-client` в backend-образе | Процесс бэкенда сам делает дамп по `DATABASE_URL` (works dev+prod). |
| Object storage | существующий `minio` Python-клиент (`app/common/storage.py`) | S3-совместим, работает с MinIO и R2, без новых зависимостей. |
| Расписание | существующий **APScheduler** (`bot/scheduler.py`) | Уже в процессе FastAPI; рантайм add/reschedule/remove job. |
| TG-доставка | существующий `aiogram.Bot` (`bot/main.py::build_bot`) | `send_document`; тот же бот, что у нотификаций. |
| Restore UI | **админка (загрузка) + CLI** | Пользователь хочет ручную загрузку; CLI — для ops в окно простоя. |
| TG > 50 МБ | **настраиваемый режим** (full_if_fits / db_only / split) | Бот шлёт ≤ 50 МБ; пользователь хочет разбивку и настройку. |
| Уровень данных | **platform-level** (глобально, не по `shop_id`) | Бэкап — вся БД целиком; ops-операция платформы. |

---

## Данные (новая миграция `0018_create_backup_tables`, down_revision = `0017`)

### `backup_config` (синглтон — ровно одна строка, id=1)

| Поле | Тип | Назначение |
|---|---|---|
| `id` | int PK (всегда 1) | синглтон |
| `enabled` | bool, default false | авто-бэкап вкл/выкл |
| `frequency` | enum `off`/`daily`/`interval` | вид расписания |
| `daily_time` | time, nullable | для `daily` — время по `Asia/Tashkent` |
| `interval_hours` | int, nullable | для `interval` — каждые N часов |
| `retention_count` | int, default 7 | хранить последних N бэкапов |
| `tg_chat_id` | bigint, nullable | куда слать (chat id platform-admin) |
| `tg_auto_send` | bool, default false | слать после каждого авто-бэкапа |
| `tg_delivery_mode` | enum `full_if_fits`/`db_only`/`split`, default `full_if_fits` | как доставлять |
| `tg_part_size_mb` | int, default 49 | размер части для `split` |
| `updated_at` | timestamptz | аудит |

### `backup_runs` (история)

| Поле | Тип | Назначение |
|---|---|---|
| `id` | int PK | id бэкапа (используется в имени файла/частей) |
| `created_at` | timestamptz | момент бэкапа |
| `status` | enum `running`/`ok`/`failed` | результат |
| `trigger` | enum `manual`/`auto` | кто запустил |
| `filename` | text, nullable | имя архива на volume |
| `size_bytes` | bigint, nullable | размер архива |
| `object_count` | int, nullable | сколько файлов вошло |
| `alembic_revision` | text, nullable | ревизия схемы на момент бэкапа |
| `sent_to_tg` | bool, default false | была ли TG-доставка |
| `error` | text, nullable | текст ошибки при `failed` |

---

## Формат архива

Канонический артефакт на сервере — всегда **цельный** файл:

```
malika-backup-<YYYYMMDD-HHMMSS>.tar.gz
├── manifest.json     { backup_id, created_at, app_version, alembic_revision,
│                       db_name, object_count, bucket }
├── database.dump     # pg_dump -Fc (вся БД)
└── objects/          # все объекты бакета, ключи сохранены 1:1
    └── <shop_id>/<scope>/<uuid>/<file>
```

Разбивка на части — **только транспорт для Telegram** (см. ниже). Канонический
архив на volume не дробится.

---

## Компоненты

### 1. Ядро — `backend/app/features/backup/`

```
backup/
├── models.py      # BackupConfig, BackupRun (+ enums)
├── schemas.py     # Pydantic: ConfigIn/Out, RunOut
├── repository.py  # CRUD config (get-or-create singleton) + runs
├── service.py     # create_backup / restore_backup / deliver_to_tg / prune
├── storage_ops.py # обёртки над minio: iter_objects / download_all / upload_all
└── router.py      # admin-эндпоинты
```

**`service.create_backup(db, trigger) -> BackupRun`**
1. Создать `backup_runs` строку (`status=running`).
2. Во временной директории: `pg_dump -Fc "$DATABASE_URL" -f database.dump`
   (через `asyncio.create_subprocess_exec`, проверка кода возврата).
3. `storage_ops.download_all()` — перечислить объекты бакета (`minio.list_objects(recursive=True)`)
   и скачать каждый в `objects/<key>` (`minio.fget_object`).
4. Записать `manifest.json` (включая текущую alembic-ревизию — читается из
   `alembic_version` таблицы).
5. `tar.gz` всей директории → `/backups/malika-backup-<ts>.tar.gz`.
6. Обновить `backup_runs` (`ok`, filename, size, object_count, alembic_revision).
7. `prune()` — удалить файлы+строки сверх `retention_count`.
8. Вернуть run. Ошибка на любом шаге → `status=failed`, `error`, временные
   файлы удаляются.

**`service.restore_backup(db, archive_path) -> None`**
1. Распаковать во временную директорию, прочитать `manifest.json`.
2. Проверить `alembic_revision` манифеста против текущей; при несовпадении —
   предупредить (в API вернуть 409 с понятным сообщением, если не передан
   `force=true`).
3. `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" database.dump`.
4. `storage_ops.upload_all(objects/)` — залить объекты обратно (overwrite по
   ключу). Опция «очистить бакет перед заливкой» — НЕ делаем (overwrite
   достаточно; удаление лишних объектов оставляем на будущее, отметить как
   ограничение).
5. ⚠️ Restore затирает живую БД — выполняется под явным подтверждением;
   документируем «делать в окно простоя».

**`service.deliver_to_tg(run, config, bot) -> None`** — режимы:
- `full_if_fits`: если `size ≤ part_size*1MB` → `send_document` целиком; иначе
  fallback на `db_only` + текстовое сообщение «фото слишком большие, полный
  архив в админке».
- `db_only`: извлечь `database.dump` из архива (или хранить отдельно) и слать
  только его.
- `split`: бинарно разрезать архив на части по `tg_part_size_mb`; имя части
  `malika-backup-<id>-<YYYYMMDD-HHMMSS>.partNN`; подпись каждого документа:
  `Бэкап #<id> · <дата> · часть X/N`. Восстановление из частей: пользователь
  скачивает все части → `cat *.part* > archive.tar.gz` → грузит в админке/CLI
  (описать в подсказке UI и в README).
- После успешной доставки — `sent_to_tg=true`.

**`storage_ops`** — добавить в это место (НЕ в общий `app/common/storage.py`,
чтобы не раздувать его) обёртки `iter_keys()`, `download_all(dest)`,
`upload_all(src)` поверх `minio` клиента из `app/common/storage.py`.

### 2. Расписание — правка `backend/bot/scheduler.py`

- При старте приложения: прочитать `backup_config`; если `enabled` —
  зарегистрировать job (`CronTrigger` для `daily`, `IntervalTrigger` для
  `interval`) с id `"backup"`.
- Функция `apply_backup_schedule(scheduler, config)` — добавляет/перенастраивает/
  удаляет job `"backup"` по конфигу. Вызывается на старте и после `PUT config`.
- Тело job: `create_backup(trigger="auto")`; затем, если `tg_auto_send` —
  `deliver_to_tg`.
- Bot для доставки: переиспользовать экземпляр, уже создаваемый в
  `app/main.py` lifespan (положить на `app.state.bot` или передать в фабрику
  scheduler), как это сделано для канала нотификаций.

### 3. Backend API — `backend/app/features/backup/router.py` (все под `CurrentAdmin`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/admin/backup/config` | текущие настройки |
| PUT | `/admin/backup/config` | сохранить настройки → `apply_backup_schedule` |
| GET | `/admin/backup/runs` | история (пагинация) |
| POST | `/admin/backup/run` | «сделать бэкап сейчас» (trigger=manual) |
| GET | `/admin/backup/runs/{id}/download` | стрим `.tar.gz` (StreamingResponse) |
| POST | `/admin/backup/runs/{id}/send-telegram` | отправить вручную |
| POST | `/admin/backup/restore` | upload `.tar.gz` (multipart) + `?force=` → restore |

Подключить router в админский агрегатор (туда же, где регистрируется
`app/features/admin/router.py`).

### 4. Админка — `admin/src/pages/Backup.tsx`

- Новый пункт навигации «Бэкап» + роут (по образцу существующих страниц
  `Users.tsx`, `Stats.tsx`).
- **Настройки:** тумблер авто-бэкапа; периодичность (Выкл / Ежедневно в HH:MM /
  Каждые N часов); «хранить последних N»; TG-блок (chat id, авто-отправка,
  режим доставки full/db/split, размер части).
- **Действия:** кнопка «Сделать бэкап сейчас».
- **История:** таблица (дата, размер, файлов, статус, в TG) с кнопками
  «Скачать» и «Отправить в TG».
- **Восстановление:** блок загрузки `.tar.gz` с **красным предупреждением** и
  явным подтверждением (ввести слово/чекбокс) — затирает текущие данные.
- API-слой в `admin/src/api/` (по образцу существующих), i18n-ключи `backup.*`
  (админка строится по ключам — см. `admin/src/i18n/`).

### 5. CLI — `backend/scripts/backup.py`, `backend/scripts/restore.py`

- `uv run python -m scripts.backup` → `create_backup(trigger="manual")`,
  печатает путь к архиву.
- `uv run python -m scripts.restore <archive> [--yes] [--force]` → подтверждение,
  затем `restore_backup`. Обёртки поверх того же `service`.

### 6. Инфраструктура

- **backend Dockerfile** (`backend/Dockerfile`): доустановить `postgresql-client`
  (PG16-совместимый `pg_dump`/`pg_restore`).
- **`docker-compose.yml`** и **`deploy/docker-compose.prod.yml`**: volume
  `backup_data:/backups` на сервис `backend`.
- **`.env.example`** и **`deploy/.env.prod.example`**: добавить (опционально)
  `BACKUP_DIR=/backups`.
- **`.gitignore`**: `/backups/` и `backups/` (на случай локального запуска).

---

## Поток данных

```
[admin UI / CLI / APScheduler]
        │ trigger
        ▼
service.create_backup ──► pg_dump (DATABASE_URL) ──► database.dump
        │                 storage_ops.download_all ─► objects/
        │                 manifest.json
        ▼
   tar.gz → /backups/…    ──► backup_runs(ok) ──► prune(retention)
        │
        ├─(auto & tg_auto_send)─► deliver_to_tg ──► aiogram send_document
        └─(admin download)─────► StreamingResponse

restore: upload .tar.gz ─► distrib check ─► pg_restore --clean ─► upload_all
```

---

## Обработка ошибок

- `pg_dump`/`pg_restore` ненулевой код → `failed` + stderr в `error`; временные
  файлы чистятся; API → 500 с безопасным сообщением (без утечки путей).
- Нет места на диске / volume не смонтирован → ловим, `failed`, понятное
  сообщение в UI.
- TG-доставка упала (сеть/лимит) → бэкап всё равно `ok`, `sent_to_tg=false`,
  ошибка доставки в лог + статус в истории.
- Restore при несовпадении alembic-ревизии → 409, требовать `force=true`.
- PII: НИКОГДА не логировать содержимое объектов/манифеста с путями к
  документам (правило §10 CLAUDE.md).

---

## Тестирование (pytest, реальный Postgres — правило §13)

1. **Round-trip:** seed данные (магазин, сделка, attachment с файлом в MinIO) →
   `create_backup` → удалить/изменить строки и объект → `restore_backup` →
   проверить, что БД и объект вернулись к исходному состоянию.
2. **Retention:** создать N+2 бэкапа → `prune` оставляет ровно N (файлы+строки).
3. **Манифест:** `create_backup` пишет корректную alembic-ревизию и object_count.
4. **Split:** архив > part_size режется на ожидаемое число частей; `cat` частей
   даёт байт-в-байт исходный архив.
5. **Авторизация:** не-admin → 403 на всех `/admin/backup/*`.
6. **Schedule:** `apply_backup_schedule` с `enabled=false` снимает job; с
   `daily`/`interval` — регистрирует с правильным триггером.

---

## Вне рамок (YAGNI / будущее)

- Шифрование архива (отклонено пользователем).
- Авто-отправка частей с автоматической пересборкой при restore из TG (сейчас
  пересборка ручная через `cat`).
- Удаление «осиротевших» объектов бакета при restore (только overwrite).
- Бэкап по отдельному магазину (делаем целиком).
- Выгрузка архива во внешнее облако (S3/R2 backup bucket) — возможное развитие.

---

## Открытые мелочи для плана

- Точное имя агрегатора, куда монтируется admin-router (проверить
  `app/main.py` / `app/features/admin/__init__.py`).
- Где взять chat_id platform-admin для `tg_chat_id` (ввод вручную в UI vs захват
  при `/start` бота) — для MVP: ручной ввод поля.
- Способ передать `app.state.bot` в scheduler-джобу (фабрика/замыкание).
