# Pre-deploy audit — 2026-05-29

Прогон Mini App + backend через Playwright и тесты. Ниже всё, что нашёл, по приоритетам.

## Контекст

- Ветка `fix/bottomnav-hooks-order` запушена (PR: https://github.com/DECAPITATION770/MalikaPerekup/pull/new/fix/bottomnav-hooks-order — `gh` не установлен, создай руками).
- Backend: 147 passed (после `CREATE DATABASE malika_test` в `malika_postgres` — про порт 5433 ниже).
- Frontend: `pnpm build` ✓, `tsc --noEmit` ✓, `pnpm lint` ✓ (0 errors, 13 безобидных `react-refresh/only-export-components` warning).
- UI smoke прошёл: `/`, `/stock`, `/stock/1`, `/purchase/new` (полный флоу до создания), `/sale/new`, `/installments`, `/reports`, `/catalog`, `/counterparties`, `/settings`, `/d/{qr_token}` — после описанных ниже фиксов всё открывается без error-boundary.

---

## P0 — БЛОКЕРЫ ДЕПЛОЯ

### P0-1. Backend Docker-образ отстаёт от исходников на ~5 миграций
Образ, который сейчас в `malika_backend`, был собран до того, как в код добавили:
- `0010_create_cbu_rate_cache` — кэш курсов ЦБУ
- `0011_add_device_defects` — колонка `devices.defects`
- `0012_add_files_cleaned_flag` — флаг для GC файлов после удаления
- `0013_create_catalog_models` — таблица каталога моделей
- `0014_add_catalog_purchase_count` — счётчик покупок в каталоге

ORM-модель и Pydantic-схема в репо уже работают с этими колонками. В старом образе их нет → `Device` без атрибута `defects` → фронт падал на `d.defects.length` (см. P1-1).

**Что делать перед деплоем:**
```bash
docker compose build backend migrate
docker compose up -d migrate  # должен выйти 0
docker compose up -d backend
```

Я уже пересобрал локально и применил миграции — проверено, `Device.defects` появилось.

### P0-2. В compose-стеке два сервиса для миграций
В `docker-compose.yml` есть отдельный сервис `migrate` (`alembic upgrade head` с `restart: "no"`, `depends_on.postgres.healthy`) — и `backend` зависит от `migrate.service_completed_successfully`. Это правильно, но он использует **тот же образ что и backend**. Если CI пересобирает только один — миграции отстают. Убедись, что в проде:
- либо общий образ пересобирается перед каждым деплоем,
- либо `migrate` собирается явно (`docker compose build migrate backend`).

### P0-3. `tests/conftest.py` зашит на порт 5433, который занят SSH-туннелем
```python
"postgresql+asyncpg://malika:malika@localhost:5433/malika_test"
```
На текущей машине порт 5433 занят `ssh` (PID 23552, бекграунд-туннель — посмотри в LaunchAgents). Поэтому `infra/docker-compose.yml --profile test up postgres_test` падает с `Bind for 0.0.0.0:5433 failed`. Сейчас я обошёл, создав `malika_test` в основном `malika_postgres` (порт 5432) и запустив тесты с `DATABASE_URL=...5432/malika_test`. Это работает, но в CI/проде нужно решить:
- убить ssh-туннель и держать 5433 для test postgres, **или**
- сменить порт в `conftest.py` и `infra/docker-compose.yml` (например, `15433`).

---

## P1 — баги, которые повлияют на пользователей

### P1-1. `BottomNav` — нарушение rules-of-hooks (УЖЕ ПОФИКСИЛ в ветке)
Хук `useQuery` стоял **после** `if (...) return null`. На переходе `/ → /purchase/new` приложение крашилось в ErrorBoundary. См. `fix/bottomnav-hooks-order` (1 файл, 7+/7-).

### P1-2. Небезопасные `.length` на необязательных полях API
Если бекенд когда-нибудь вернёт `photos: null` / `defects: null` / `events: null` (например, при добавлении нового статуса, частичной выдаче или ошибке миграции — см. P0-1), фронт упадёт. Найдено:

- `tenant/src/pages/Catalog.tsx:319` — `draft.photos.length`
- `tenant/src/pages/StockDetail.tsx:236, 308, 309, 333` — `d.photos.length`, `d.defects.length`
- `tenant/src/pages/sale/steps/StepSaleDevice.tsx:203, 239, 242, 275` — `device.photos.length`, `device.defects.length`
- `tenant/src/pages/purchase/steps/StepDevice.tsx:143` — `u.item.photos.length`

Минимально: заменить на `?.length ?? 0` или `(arr ?? []).length` в коде, плюс на бекенде сделать схему **строгой** (`from_attributes=True` сейчас тихо роняет недостающие поля, нужен `model_validate` с явной валидацией). Defense-in-depth: фронт защищается от мусора, бекенд гарантирует контракт.

### P1-3. Все list-endpoints возвращают 307 на trailing slash
Я проверил curl'ом:
```
/api/v1/devices         200
/api/v1/devices/        307
/api/v1/sales/          307
/api/v1/installments/   307
/api/v1/counterparties/ 307
```
Сам по себе 307 не баг, но в проде с CORS и `Authorization` header это **второй preflight на каждый запрос-со-слэшем**. Браузер кэширует preflight, но любой инструмент (Postman, curl скрипты у клиента) увидит задержку. Зафиксируй один стиль:
- либо везде роуты с trailing slash и `app = FastAPI(redirect_slashes=False)` плюс фронт без слэша,
- либо везде без слэша, но проверь — сейчас фронт частично шлёт со слэшем (`api/v1/devices/`), отсюда и редиректы.

### P1-4. Aria-label «Закрыть» не локализован
Кнопка-крестик в Radix Dialog имеет `aria-label="Закрыть"` даже когда весь UI на UZ. Нашёл при попытке зайти на `/sale/new` (модалка «Sotuvni davom ettirasizmi?»). Подмени через i18n в shadcn-обёртке Dialog (`components/ui/dialog.tsx`).

### P1-5. Сид-скрипт `scripts/seed_demo.py` сломан после v2-отката
Он импортирует `build_upload_key` из `app.common.storage`, которой в v1 не существует:
```
ImportError: cannot import name 'build_upload_key' from 'app.common.storage'
```
Я обошёл, написав `seed_min.py` (создание шопа+владельца без устройств). Перед деплоем либо удали сид-скрипт, либо приведи его к v1 (фотки можно не сидить, либо использовать `app.common.storage.upload_key` если такая функция есть).

Дополнительно: `scripts/` не копируется в Docker-образ (`Dockerfile` копирует только `app`, `bot`, `alembic`, `alembic.ini`). Поэтому даже исправленный сид не запустится в проде через `docker compose exec backend`. Реши намерение: либо это локальный dev-only тул и `scripts/` остаётся вне образа, либо тащи в образ.

---

## P2 — UX / архитектурные странности

### P2-1. Дашборд показывает «Прибыль сегодня / Замороженные деньги / Долги по рассрочке» — в этом порядке всё ОК и совпадает с CLAUDE.md #15. Но:
- «Замороженные деньги» считаются как стоимость витрины (`Σ purchase_price` для `status=in_stock`) — это видно по описанию «0 устройств на витрине». В реальности «замороженные деньги» это закупочная цена. Названо правильно, но проверь формулу в `services/`.
- Под этими тремя — мини-блок «Продано / Куплено / Выручка» с тремя числами без подписей валюты. Это дублирует часть верхних. **Стоит убрать или объединить** — он сейчас выглядит «второй ряд KPI», но не несёт новой info.

### P2-2. UI разговаривает на UZ, header показывает «RU» — потом «UZ»
Я залогинился (стартовал из логин-страницы на RU), а дашборд и далее показал UZ. Видимо `user.language='ru'` создан, но в localStorage `tenant_lang` уже стояло `uz` и оно победило. Это запутывает первого пользователя: «я выбрал русский в Settings, а вижу UZ». Решения:
- При логине жёстко синхронизировать localStorage с `user.language`,
- Либо вообще не хранить язык в localStorage если есть авторизация — брать только из user.

### P2-3. Кнопка `Davom` (Продолжить) в мастере не дизейблится при незаполненных полях
На шаге 1 покупки, если очистить «Brend» и «Modeli» (оба `*`-обязательные), `Davom` всё равно кликабельна — упирается только в submit-валидацию. Лучше — `disabled={!valid}`, без хаоса с тостами на каждом шаге.

### P2-4. Кнопка «Принять закупку» на пустом дашборде неоднозначно работает с навигацией
На `/` есть и BottomNav кнопка «Olish» (с цветным акцентом), и большая CTA «Принять закупку» в hero. Обе ведут на `/purchase/new`. Это нормально, но при empty-state хочется одну заметную точку входа — иначе «вот тут уже было «Olish», зачем ещё кнопка». Можешь оставить как есть, но если UX'ер захочет упрощать — это первое.

### P2-5. На `/sale/new` модалка «Sotuvni davom ettirasizmi?»
Поднимается даже если предыдущая «начатая продажа» — это просто я зашёл на роут, ничего не вводя, и ушёл. Видимо вы складываете draft при первом `dispatch` редьюсера, а не при первом вводе пользователя. Если так — лучше создавать draft только когда юзер выбрал устройство. Иначе после первой сессии модалка показывается «всегда».

### P2-6. Каталог `/catalog` пустой — `total: 0`
Это ожидаемо после P0-1 (таблица `catalog_models` только что создана). Но в UI это показывается как полноценная страница без подсказки «как добавить первую модель». Нужен empty-state для нулевого каталога. Сейчас визуально кажется что фича сломана.

### P2-7. Каноничная иконка-логотип отрисовывается дважды
В header'е сразу два `<img alt="Малика">` (e10 и e15 в снэпшоте дашборда), один из них — `<generic>Малика</generic>`. Скорее всего лого + текст рендерятся как два img + текст. Безопасно, но screen readers могут читать «Малика. Малика». Один сделай `aria-hidden="true"`.

---

## P3 — что НЕ работает, но не блокер

### P3-1. `gh` CLI не установлен на машине
PR пришлось бы открывать руками. Поставь: `brew install gh && gh auth login` — пригодится для скриптов деплоя.

### P3-2. Vite-демоны не убираются после `pnpm dev`
Я нашёл три параллельных Vite-процесса (sun 12am, sun 4pm, sun 10pm) — каждый держал старый port=5173 из прежнего config. Сейчас порт = 5175. Если ты их не убил, после rebase/pull/смены конфига они продолжают есть память и confuse тулзы. Добавь `pgrep -f "tenant/node_modules/.bin/vite" | xargs kill` в pre-dev скрипт или используй `pnpm run dev:clean`.

### P3-3. `node_modules` после v2-отката был не пересинхронен
Я делал `pnpm install` руками — `package.json` ждал `@vitejs/plugin-react-swc`, в `node_modules` стоял `@vitejs/plugin-react`. После любого `git pull` / переключения веток нужно `pnpm install`. Это норма, но лефтхук-хук pre-merge на это смотрит? Если нет — добавь.

### P3-4. ESLint warnings (13) про `react-refresh/only-export-components`
Только Fast Refresh warnings, на runtime не влияет. Чисто стилистическое — разнести non-component exports в отдельные `.ts` файлы. Можно отложить.

### P3-5. React Router v7 future-flag warnings
В консоли при каждом маунте:
```
React Router will begin wrapping state updates in React.startTransition…
Relative route resolution within Splat routes is changing…
```
Включи `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` в `BrowserRouter` — будет тише и заранее проверишь совместимость с v7.

### P3-6. Sentry init с `dsn` undefined → warning
Если в `.env` нет `VITE_SENTRY_DSN`, `initSentry()` всё равно вызывается и Sentry молча no-op'ит. Это ОК, но в проде проверь что DSN выставлен — иначе ошибки просто не дойдут.

---

## Чек-лист перед деплоем

- [ ] **Пересобрать backend и migrate образы:** `docker compose build backend migrate`.
- [ ] **Прогнать миграции в стейджинге:** `docker compose up -d migrate` → exit 0.
- [ ] **Замёрджить `fix/bottomnav-hooks-order`** (P1-1).
- [ ] **Защитить фронт от `null` массивов** (P1-2) — минимум для `defects`, `photos`, `events`.
- [ ] **Решить trailing-slash policy** (P1-3) — чтобы прод не страдал двойными preflight'ами.
- [ ] **Локализовать aria-label «Закрыть»** (P1-4).
- [ ] **Починить или удалить `scripts/seed_demo.py`** (P1-5).
- [ ] **Проверить порт 5433** в проде/CI для test postgres (P0-3).
- [ ] **Установить `VITE_SENTRY_DSN` и `BOT_TOKEN`** в проде (см. P3-6 и `.env.example`).
- [ ] **Сделать smoke по тем же 11 роутам после деплоя:** `/`, `/login`, `/stock`, `/stock/<id>`, `/purchase/new`, `/sale/new`, `/installments`, `/reports`, `/catalog`, `/counterparties`, `/settings`, `/d/<qr_token>`.

---

## Артефакты smoke-теста

- `purchase-step1.png`, `purchase-step2.png`, `stock-after-purchase.png`, `stock-detail.png` — в корне репо.
- Ветка `fix/bottomnav-hooks-order` запушена в origin.
- Тестовая БД `malika_test` создана в `malika_postgres` (можно удалить: `DROP DATABASE malika_test`).
- Демо-владелец: `malika / malika12345` (shop_id=1, user_id=1) — это **локальная демка**, в проде такого юзера быть не должно.
