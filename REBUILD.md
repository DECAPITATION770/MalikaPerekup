# Malika Perekup — Rebuild 2026 (feat/rebuild-2026)

Полная пересборка `tenant/` (Telegram Mini App) на современный стек +
добивка backend. Снимок MVP до ребилда — тег `v0.1-mvp-snapshot` /
ветка `pre-rebuild-2026-05-21`.

## Frontend (`tenant/`) — новый стек

| Слой | Что |
|---|---|
| UI | **shadcn/ui** на Radix (19 примитивов) + кастомные KpiCard, EmptyState |
| Bottom-sheet | **vaul** (мобильные фильтры, speed-dial) |
| Toasts | **sonner** |
| Charts | **recharts** (Reports: area profit-by-day, bar top-models) |
| Animations | **framer-motion** (page/step transitions, FAB, offline banner) |
| Command palette | **cmdk** (Search) |
| Telegram | **@telegram-apps/sdk-react v3** — MainButton, BackButton, haptic, themeParams (light/dark) |
| Data | TanStack Query v5 + persistQueryClient (24h localStorage) |
| Forms | react-hook-form + zod |
| Offline | vite-plugin-pwa (workbox) + IndexedDB payment queue (idb-keyval) |
| Monitoring | Sentry (`@sentry/react`) + Plausible analytics |
| Build | Vite + SWC, gzip+brotli compression, route-level code-split |
| Quality | ESLint flat + Prettier + lefthook (pre-commit), Vitest + Playwright + axe |

### Identity
- Brand wordmark «Малика» с амбра-точкой над «и» + компактный `MalikaLogo`
- 7 кастом-иконок (Nasiya, QrSticker, Frozen, Restock, Marketplace, RepeatLast, MalikaLogo)
- 4 SVG-иллюстрации для empty states
- Accent — тёплая амбра `#E89A2E` (вместо дефолтного Tailwind amber)
- Dark-first + светлая тема через `.light` CSS-переменные (по themeParams Telegram)
- Реальный `useCountUp` (RAF + cubic-easeOut + reduce-motion)

### Страницы (15/15 переписаны)
Login · Today · Stock · StockDetail · PurchaseNew (4-шаговый wizard) ·
SaleNew · Installments · Reports · Counterparties · CounterpartyDetail ·
Settings · Search · DeviceByToken · Purchases · Sales

## Backend (`backend/`) — добивка

- **structlog** с PII-scrub processor (CLAUDE.md §10) — JSON в prod, цветной в dev
- **Sentry** (`sentry-sdk[fastapi]`) с PII-scrub before_send
- **Prometheus** (`prometheus-fastapi-instrumentator`) на `/internal/metrics`
- **S3 cascade-delete** — hourly APScheduler job чистит doc_photos
  soft-deleted counterparties из MinIO/R2 (миграция 0012, `files_cleaned` flag)
- Тесты: cross-shop isolation (5), cascade-delete (4), PII-scrub (9) → **120 pytest зелёных**

## Команды

```bash
# Frontend
cd tenant && pnpm dev          # dev server :5175
cd tenant && pnpm build        # production + PWA
cd tenant && pnpm test         # vitest (23)
cd tenant && pnpm exec playwright test   # e2e + axe (5)

# Backend
cd backend && uv run pytest    # 120 tests (нужен postgres_test)
cd backend && uv run uvicorn app.main:app --reload
```

## Известные follow-up

- Light-тема: «faded» badge-комбинации (success/danger text на -faded тинтах,
  11-12px) ещё < WCAG AA — вторичная тема, dark (дефолт) чист.
- DocumentUploader портирован as-is; перевод на react-dropzone — опционально.
- Playwright e2e против реального backend (purchase/sale/nasiya happy-path) —
  текущие e2e backend-free (Login + showcase).
