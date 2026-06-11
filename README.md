# Malika Perekup

Учётная система для перекупщиков электроники на рынке **Малика** (Ташкент).
Telegram Mini App + Telegram-бот + multi-tenant backend. Каждый магазин видит
только свои данные; вход — через Telegram либо резервный логин/пароль.

Что умеет:

- **Закуп и продажа** в 2 шага (устройство → сделка) с черновиком, подсказками
  моделей и цен, предупреждением о дубле IMEI.
- **Склад (витрина)** с карточками устройств и QR-стикерами — скан открывает
  весь акт закупа.
- **Nasiya (рассрочка)** с графиком платежей и учётом долгов.
- **Справочник контрагентов** (CRM) — повторных продавцов/покупателей не нужно
  вводить заново.
- **Дашборд** из 3 чисел: прибыль сегодня / замороженные деньги / долги.
- **Отчёты** — разрезы по любым измерениям + выгрузка в Excel.
- **i18n**: русский + узбекский (латиница), таймзона `Asia/Tashkent`.
- **Админ-панель** платформы (управление магазинами/тенантами).

---

## Архитектура

```
                 Telegram
                    │  initData (HMAC) / бот
                    ▼
┌─────────────────────────────────────────────────────────┐
│  tenant   (Mini App, React SPA)   :5175                  │
│  admin    (Admin panel, React)    :5174                  │
└───────────────┬─────────────────────────────────────────┘
                │  /api/v1  (JWT, 24h)
                ▼
┌─────────────────────────────────────────────────────────┐
│  backend   FastAPI + aiogram-бот в одном процессе  :8000 │
└───────┬─────────────┬─────────────────┬─────────────────┘
        ▼             ▼                 ▼
    PostgreSQL      Redis        Object storage
      :5432         :6379       MinIO :9000 / R2
```

В проде перед `tenant`/`admin`/`backend` стоит nginx-edge с TLS
(Let's Encrypt). Подробности — в [`deploy/README.md`](deploy/README.md).

---

## Стек

| Слой        | Технологии                                                            |
|-------------|-----------------------------------------------------------------------|
| Backend     | Python 3.12, FastAPI, aiogram 3.x, SQLAlchemy 2.0, Alembic, `uv`       |
| Хранилища   | PostgreSQL 16, Redis 7, MinIO (dev) / Cloudflare R2 (prod)             |
| Mini App    | React 18, Vite, TypeScript, TanStack Query, react-i18next, Tailwind    |
| Admin       | React 18, Vite, TypeScript, shadcn/ui                                  |
| Пакеты      | Backend — `uv`; фронт — `pnpm`                                         |

---

## Структура репозитория

```
backend/        FastAPI + бот (features/, alembic/, tests/)
tenant/         Telegram Mini App (React SPA)
admin/          Админ-панель платформы (React SPA)
deploy/         Прод-деплой: docker-compose.prod.yml, nginx, .env.prod.example
docker-compose.yml   Локальный стек (postgres, redis, minio, backend, admin)
.env.example         Шаблон конфигурации backend
```

---

## Быстрый старт

Нужно: Docker + Compose, [`uv`](https://docs.astral.sh/uv/), Node 20 +
[`pnpm`](https://pnpm.io/). Дальше — три способа запуска, от «руками» до
полностью контейнеризованного.

### Способ 1 — Локальная разработка (рекомендуется для кодинга)

Инфраструктуру (БД, Redis, MinIO) поднимаем в Docker, а backend и фронт
запускаем нативно — так работает hot-reload.

```bash
# 0. Конфиг
cp .env.example .env          # для локалки значения по умолчанию подходят

# 1. Только инфраструктура
docker compose up -d postgres redis minio

# 2. Backend (API + бот в одном процессе) + миграции
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload      # → http://localhost:8000

# 3. Mini App (в новом терминале)
cd tenant
pnpm install
pnpm dev                                   # → http://localhost:5175

# 4. Админ-панель (опционально, ещё один терминал)
cd admin
pnpm install
pnpm dev                                   # → http://localhost:5174
```

Фронт проксирует `/api` на `http://localhost:8000`, отдельной настройки не
нужно. Mini App разрешает ngrok-хосты (`*.ngrok-free.app` и т.п.) — удобно,
чтобы открыть приложение прямо в Telegram через туннель.

> **Telegram-вход в dev.** Чтобы не гонять `initData` каждый раз, поставьте в
> `.env`: `DEV_AUTH_BYPASS=true` и `DEV_BYPASS_USER_ID=1`. В проде это
> **запрещено** — backend откажется стартовать.

### Способ 2 — Весь стек в Docker (dev)

Один `compose up` на всё: Postgres, Redis, MinIO, миграции, backend и admin
собираются и поднимаются автоматически.

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f backend
```

Поднимется:

| Сервис   | URL                       |
|----------|---------------------------|
| backend  | http://localhost:8000     |
| admin    | http://localhost:8080     |
| MinIO UI | http://localhost:9001     |

Mini App (`tenant`) в dev-compose не собирается — для неё используйте
`pnpm dev` из способа 1 (так работает hot-reload). Остановить всё:
`docker compose down` (с очисткой данных — `docker compose down -v`).

### Способ 3 — Продакшен

Полный прод-стек (Mini App + admin + API/бот + Postgres + Redis) на одном
Linux-хосте, за nginx-edge с TLS Let's Encrypt. Backend намеренно **отказывается
стартовать**, если `JWT_SECRET` дефолтный/короче 32 символов, либо включён
`DEV_AUTH_BYPASS`/`DEBUG`.

Полный пошаговый разбор (DNS, сертификаты, R2, секреты) —
**[`deploy/README.md`](deploy/README.md)**. Кратко:

```bash
cp deploy/.env.prod.example deploy/.env.prod
$EDITOR deploy/.env.prod                  # заполнить каждый CHANGE_ME

openssl rand -hex 32                       # → JWT_SECRET
openssl rand -hex 24                       # → POSTGRES_PASSWORD

docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

---

## Конфигурация (`.env`)

Backend читает `.env` (см. `.env.example`). Ключевые переменные:

| Переменная              | Назначение                                                 |
|-------------------------|------------------------------------------------------------|
| `ENVIRONMENT`           | `dev` / `prod`                                             |
| `DEBUG`                 | подробные ошибки; в проде только `false`                  |
| `DATABASE_URL`          | `postgresql+asyncpg://malika:malika@localhost:5432/malika` |
| `REDIS_URL`             | `redis://localhost:6379/0`                                |
| `S3_*`                  | MinIO (dev) или R2/S3 (prod); фото документов — private    |
| `JWT_SECRET`            | ≥ 32 случайных символов (`openssl rand -hex 32`)           |
| `BOT_TOKEN`             | токен бота от [@BotFather](https://t.me/BotFather)         |
| `BOT_WEBAPP_URL`        | публичный URL Mini App                                     |
| `DEV_AUTH_BYPASS`       | только dev; **никогда** `true` в проде                     |
| `BOOTSTRAP_ADMIN_*`     | первый админ платформы при первом запуске                  |
| `DEFAULT_LANGUAGE`      | `ru` / `uz`                                                |
| `TIMEZONE`              | `Asia/Tashkent`                                            |

**Фронт** (`tenant`, `admin`) собирается с переменными `VITE_APP_ENV`,
`VITE_APP_VERSION`, `VITE_SENTRY_DSN` (все опциональны).

> Файлы `.env`, `.env.prod` и бэкапы в гит не попадают (`.gitignore`).
> Под версионированием только `*.example`.

---

## Тесты

```bash
# Backend — против реального Postgres (НЕ SQLite). Тесты дропают и пересоздают
# схему, поэтому используется ОТДЕЛЬНАЯ тестовая БД на порту 5433.
docker compose --profile test up -d postgres_test
cd backend && uv run pytest                # 159 тестов

# Frontend — vitest + typecheck
cd tenant && pnpm test && pnpm typecheck    # 34 теста
```

> Если порт 5433 занят другим Postgres, направьте тесты на свою БД явно:
> `DATABASE_URL="postgresql+asyncpg://malika:malika@localhost:5432/malika_test" uv run pytest`
> (предварительно создав пустую базу `malika_test`).

Покрыто критичное: верификация Telegram `initData`, QR-токены, расчёт прибыли,
график рассрочки, изоляция по `shop_id` (магазин A не видит данные магазина B).

---

## Миграции БД

```bash
cd backend
uv run alembic revision --autogenerate -m "описание"   # новая ревизия
uv run alembic upgrade head                            # применить
uv run alembic downgrade -1 && uv run alembic upgrade head  # проверка обратимости
```

Существующие миграции после мерджа не править — только новая ревизия.

---

## Лицензия

Приватный проект. Все права принадлежат владельцу.
