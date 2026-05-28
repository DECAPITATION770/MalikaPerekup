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

## Структура

```
backend/    FastAPI app + aiogram bot + alembic
tenant/     React Mini App (открывается и в Telegram, и в браузере)
infra/      docker-compose (dev + prod) + Caddyfile
.github/    CI (typecheck + tests + build)
```

## CLAUDE.md

Правила для LLM-агентов работающих в этом репо — в `CLAUDE.md` в корне.
