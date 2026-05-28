# Malika Perekup — v2

Учётная система для перекупщиков электроники на рынке Малика (Ташкент). Личный инструмент для одного владельца магазина: учёт закупок, продаж, рассрочек, контрагентов.

**v2 — переписан с нуля.** v1 лежит в ветке `v1-archive` (`git checkout v1-archive`). Решение и контекст — `~/.claude/projects/-Users-gulmira-Documents-MalikaPerekup/memory/v2-roadmap.md`.

## Стек

- **Backend:** Python 3.12, FastAPI, aiogram 3, SQLAlchemy 2.0 (async), Alembic, Postgres 16, Redis 7. Менеджер — `uv`.
- **Frontend (tenant):** React 18 + Vite + TypeScript, Tailwind, TanStack Query, react-hook-form + zod, react-i18next. Менеджер — `pnpm`.
- **Object storage:** MinIO локально, R2 в проде.
- **Reverse proxy:** Caddy.

## Старт локально

```bash
cp .env.example .env                                # заполни секреты
docker compose -f infra/docker-compose.yml up -d   # postgres + redis + minio
cd backend && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
# в другом терминале
cd tenant && pnpm install && pnpm dev
```

Backend на `:8000`, tenant на `:5173`, /health возвращает `{"status": "ok"}`.

С `DEV_AUTH_BYPASS=true` (по умолчанию в dev) tenant в браузере залогинится как `@devadmin`
с ролью `super_admin` и покажет страницу провижининга tenant'ов («Super-admin · Tenants»).
Это позволяет тестировать админ-флоу без Telegram.

## Тест owner-флоу

Чтобы залогиниться как реальный владелец магазина (а не super-admin):

1. В админ-странице (DEV_AUTH_BYPASS=true в браузере) создай tenant через форму:
   - укажи свой Telegram username или tg_id.
2. Выключи bypass: `DEV_AUTH_BYPASS=false` в `.env`, рестарт backend.
3. Задай `SUPER_ADMIN_TG_IDS_RAW=твой_tg_id` если хочешь админ-доступ в проде через TG.
4. Открой Mini App в Telegram (нужен ngrok — см. ниже) — увидишь owner-страницу.

## Тест с настоящим Telegram (через ngrok)

1. Запусти всё локально как выше (postgres, backend, tenant).
2. В отдельном терминале — ngrok на tenant-порт:
   ```bash
   ngrok http 5173
   ```
   Скопируй HTTPS-URL (вида `https://abc123.ngrok-free.app`).
3. Положи URL в `.env`:
   ```
   WEBAPP_URL=https://abc123.ngrok-free.app
   ```
4. Перезапусти uvicorn (чтобы подхватил новый env) и запусти бота:
   ```bash
   cd backend && uv run python -m bot.main
   ```
5. Открой бота в Telegram, отправь `/start`, тапни «🛒 Открыть Malika».
   Mini App откроется — увидишь «Привет, @твой_username!»

В Telegram `getInitData()` отдаёт реальные данные → backend HMAC-верифицирует → JWT.
В обычном браузере та же страница работает через `DEV_AUTH_BYPASS=true`.

## Структура

```
backend/    FastAPI app + aiogram bot + alembic
tenant/     React Mini App (открывается и в Telegram, и в браузере)
infra/      docker-compose (dev + prod) + Caddyfile
.github/    CI (typecheck + tests + build)
```

## CLAUDE.md

Правила для LLM-агентов работающих в этом репо — в `CLAUDE.md` в корне.
