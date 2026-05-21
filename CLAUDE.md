# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project-Specific Rules — Malika Perekup

Учётная система для перекупщиков электроники на рынке Малика (Ташкент). Telegram Mini App + Telegram-бот + multi-tenant backend. Полный план — `~/.claude/plans/pasted-text-1-linked-nova.md`.

## 5. Stack — не тащить лишнее

- **Backend:** Python 3.12, FastAPI, aiogram 3.x, SQLAlchemy 2.0, Alembic, PostgreSQL 16, Redis. Менеджер зависимостей — `uv`.
- **Frontend (Mini App):** React 18 + Vite + TypeScript, `@telegram-apps/sdk-react`, TailwindCSS + shadcn/ui, TanStack Query, react-hook-form + zod, react-i18next. Менеджер — `pnpm`.
- **Хранилище фото:** MinIO (локально) / Cloudflare R2 (прод).
- Не добавлять новые библиотеки без обсуждения. Сначала проверить, нет ли уже похожего инструмента в стеке.

## 6. Multi-tenancy — критическая инвариантность

**Каждый запрос к БД ОБЯЗАН быть отфильтрован по `shop_id` текущего пользователя.**

- Использовать общий FastAPI dependency `current_shop` и фильтр в репозиториях/запросах.
- Никаких сырых SELECT без `WHERE shop_id = :shop_id`.
- В тестах обязательно сценарий: пользователь магазина A не видит данные магазина B.
- Запрещено принимать `shop_id` из тела запроса или query-параметра — только из аутентифицированного контекста.

## 7. Авторизация — Telegram + резервный логин/пароль

**Два способа входа в один и тот же аккаунт:**

1. **Telegram (основной):** Mini App присылает `initData` — верифицировать HMAC-SHA256 от `bot_token`. JWT на 24 часа.
2. **Логин/пароль (резервный):** настраивается в Settings, для входа когда Telegram недоступен. POST `/auth/login` → JWT с тем же `user_id`.

**Правила:**
- Никогда не доверять `tg_id`/`user_id` из тела запроса — только из верифицированного источника (initData или валидного JWT).
- Пароль — `bcrypt` с cost ≥ 12. Никогда не хранить plaintext.
- Логин/пароль — опциональные поля у пользователя (могут быть `NULL`, если не настраивал).
- Один пользователь = одна запись `users`, два способа авторизации ведут в одну учётку.
- В dev-режиме bypass только при явном `DEV_AUTH_BYPASS=true` в `.env`.

## 8. QR-коды

- Формат токена: `uuid4().hex` (32 hex-символа). Случайности достаточно — угадать невозможно.
- Назначение QR — открыть карточку устройства с характеристиками и историей движения. Не платёжный документ, не юридически значимая бумага.
- Защита доступа — на уровне API: `device.shop_id` должен совпадать с `current_user.shop_id`. Чужой QR возвращает 403.
- HMAC-подпись не используем — добавим если появится сценарий внешнего сканирования (покупателем без авторизации).

## 9. Деньги

- Все суммы (UZS, USD) — `Decimal` на Python и `string` на API. Никогда не `float`.
- В БД — `NUMERIC(18, 2)` для UZS, `NUMERIC(14, 2)` для USD.
- Курс валюты на момент сделки — фиксировать в самой сделке (`exchange_rate` поле), не пересчитывать задним числом.
- Расчёт прибыли (`sale_price - purchase_price`) — в одном месте (`services/profit_calc.py`), покрыт тестами.

## 10. PII (паспорта, фото документов)

- Фото документов продавца/покупателя — PII. Хранить в MinIO/R2 с **private ACL**.
- Раздавать только через подписанные URL с TTL ≤ 15 минут.
- Никогда не логировать содержимое полей `*_doc_number`, `*_phone`, `seller_photos`, `buyer_photos`.
- При удалении сделки — каскадно удалять файлы из object storage (через background-задачу).

## 11. i18n (RU + UZ-Latn)

- Никаких хардкод-строк в UI и в сообщениях бота. Только ключи + словари.
- Frontend — `react-i18next`, файлы `miniapp/src/i18n/{ru,uz}.json`.
- Backend (бот, ошибки API) — словари в `backend/app/i18n/{ru,uz}.json`, выбор по `user.language`.
- Дата/время — учитывать таймзону `Asia/Tashkent`. Хранить в UTC, отображать в локальной.

## 12. Миграции БД

- Любое изменение схемы — через Alembic (`alembic revision --autogenerate -m "..."`).
- Никогда не править существующую миграцию после мерджа — только новая ревизия.
- Перед коммитом миграции: `alembic upgrade head` локально, затем `alembic downgrade -1 && alembic upgrade head` для проверки обратимости.

## 13. Тесты

- Минимум pytest-покрытие для критичного: `verify_telegram_initdata`, `qr_token sign/verify`, `profit_calc`, фильтрация по `shop_id`, расчёт графика рассрочки.
- Интеграционные тесты — против реального Postgres в Docker, не SQLite-моков.
- Перед PR — `pytest backend/tests/` должен быть зелёный.

## 14. Dev-команды (cheat sheet)

```bash
# Backend
cd backend && uv run uvicorn app.main:app --reload
cd backend && uv run python -m bot.main
cd backend && uv run alembic upgrade head
cd backend && uv run pytest

# Frontend
cd miniapp && pnpm dev
cd miniapp && pnpm build

# Инфра локально
docker compose up -d postgres redis minio
```

## 15. UX-приоритеты (идеи из ревью)

- **Тёмная тема по умолчанию** — Mini App наследует тему Telegram, но проектировать dark-first: перекупщики смотрят на экран на ярком свету рынка. Кнопки крупные, текст контрастный.
- **"Nasiya"** — именно это слово использовать в UZ-интерфейсе вместо "рассрочка". В RU — "рассрочка".
- **Справочник контрагентов** — если повторный клиент/продавец, предлагать выбрать из списка, не вводить паспортные данные заново. Поиск по имени и номеру телефона.
- **Дашборд: 3 ключевых числа** — Прибыль сегодня / Замороженные деньги (стоимость витрины) / Долги по Nasiya. Сразу видно состояние бизнеса без погружения в детали.
- **QR-стикер** — на странице закупки кнопка «Распечатать стикер» (маленький QR для наклейки на чехол/коробку). При сканировании — мгновенно открывается весь акт закупа.

## 16. Что НЕ делать в этом проекте

- Не поднимать веб-версию вне Telegram Mini App (Mini App открывается и в Telegram Desktop — этого хватает).
- Не интегрировать эквайринг (Click/Payme) до явного запроса — все сделки «cash» в MVP.
- Не добавлять полноценную бухгалтерию (НДС/КПН) — это ниша 1С, не наша.
- Не использовать SMS до этапа 3 — все уведомления через Telegram-бот.
