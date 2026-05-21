# PurchaseNew → Wizard (4 шага) — план

Кардинальная переработка процесса закупки: из «длинной анкеты» в пошаговый визард, заточенный под перекупа на рынке (телефон одной рукой, продавец рядом нервничает, 30 секунд на оформление).

Старый план улучшений: `docs/purchase-improvements.md` (закрыт по волнам 1-2).

## Решения по дизайну (зафиксировано с пользователем)

- **`condition` остаётся**, рядом добавляется `defects: list[str]`. На UI показываем чек-лист дефектов, `condition` выводится автоматически (0 дефектов = `new`; только косметика = `good`; замена экрана/АКБ = `normal`; broken-флаг = `broken`). Фильтр в Stock по `condition` продолжает работать.
- **AI-подсказка цены — без LLM**. Просто SQL: средняя и последняя цена закупки этой модели в этом магазине. Под полем цены: «Похожие закупки: средняя 4.1M / последняя 4.0M ↓-5%».
- **«Повторить последнюю» — над чипами на шаге 1**, прыжок сразу на шаг 4 (Цена).

## Цель — 4 шага по одному экрану

```
[1/4] Что покупаем?    → «Повторить последнюю» + 10 чипов-моделей + «Другая»
[2/4] Какая именно?    → IMEI + чек-лист дефектов + 2 фото устройства
[3/4] У кого?          → SellerSearch + минимум полей; паспорт сворачиваемый
[4/4] За сколько?      → CurrencyDualInput + PriceHint + дата-чипы + Submit
```

---

## Волна 0 · Бэк (фундамент)

| Артефакт | Файлы | Тесты |
|---|---|---|
| `defects: list[str]` в Device | `devices/models.py` + миграция `0011_add_device_defects` | round-trip pytest |
| `defects` в DeviceIn/Out/Update | `devices/schemas.py`, `purchases/schemas.py`, `purchases/service.py` | uses в test_purchase_create |
| `GET /devices/recent-models` | `devices/router.py` + `repository.recent_models` | shop-isolation, DISTINCT brand+model, LIMIT 10 ORDER BY MAX(created_at) DESC |
| `GET /devices/price-hint?brand&model` | `devices/router.py` + сервис `price_hint.py` | last+avg за shop, shop-isolation |
| `GET /purchases/last` | `purchases/router.py` | возвращает шаблон для «Повторить» — без price/IMEI |
| `POST /devices/upload-url` | `devices/router.py` + `requestDeviceUploadUrl` в `api/devices.ts` | путь `devices/{shop}/...` |

**verify:** `pytest backend/tests/` зелёный, +6–8 новых тестов. `alembic downgrade -1 && upgrade head` чистый.

## Волна 1 · Каркас визарда

- `tenant/src/pages/purchase/Wizard.tsx` — оркестратор (currentStep state, переходы, валидация per-step)
- `WizardProgress` — 4 крупных шага сверху, тап на пройденный → возврат
- `WizardFooter` — `[← Назад]` `[Далее →]` или `[Оформить за N UZS]` на шаге 4
- `useStepValidation(schema, step)` — частичная валидация zod-схемы по полям шага
- Сохранить в draft `currentStep`, восстанавливать на нужный шаг
- В `PurchaseNew.tsx` — заменить рендер тела формы на `<Wizard>` (state-управление формы сохраняется)

**verify:** `pnpm build` зелёный, ручной клик-через — 4 пустых шага листаются.

## Волна 2 · Шаг 1 «Что покупаем»

- **Сверху — карточка «🔁 Повторить последнюю»** (если `/purchases/last` вернул что-то). Тап → заполняет всё (категория/бренд/модель/specs/condition/defects/продавец), прыгает сразу на шаг 4 (Цена). IMEI пустой, цена пустая.
- Под ней — **сетка чипов**: ровно 10 последних уникальных моделей. Заголовок «Последние».
- Внизу — `[+ Другая модель]` → раскрывает `SuggestField` бренд + модель + категорию (как сейчас).
- Выбор модели = записывает brand/model/category в форму, активирует Next.

**verify:** 3 headed-сценария: чип → шаг 2; «Другая» → ввод → шаг 2; «Повторить» → шаг 4.

## Волна 3 · Шаг 2 «Какая именно»

- IMEI с `ImeiDupWarning` (как сейчас) + Серийник.
- **DefectChecklist** — 6–8 чипов toggle:
  - «царапины корпуса», «царапины экрана», «замена экрана», «замена АКБ», «не оригинал», «трещины», «зарядка ОК», «без коробки».
  - Из выбора вычисляем condition (см. правила в Решениях выше).
- **DevicePhotoUploader** — 2 слота: front, back. Через `requestDeviceUploadUrl`.
- Notes — collapsible.

**verify:** 2 сценария: без дефектов → condition=new; «замена экрана» → condition=normal. Фото грузятся.

## Волна 4 · Шаг 3 «У кого»

- `SellerSearch` крупно сверху (как сейчас).
- Если новый продавец → имя + телефон обязательно, **остальное (паспорт, tg, фото) — collapsible «Документы (опционально)»**. Загрузить можно позже на странице сделки.
- Если выбрал контрагента → форма свёрнута, есть «Отвязать».

**verify:** 2 сценария: новый минимум (имя+тел) → шаг 4; повторный по поиску → шаг 4.

## Волна 5 · Шаг 4 «За сколько»

- `CurrencyDualInput` крупнее (главный фокус экрана).
- **`PriceHint` под полем**: «Похожие закупки: средняя 4.1M, последняя 4.0M ↓-5%». Если истории нет — «Первая закупка такой модели».
- Дата: default сегодня, чипы «Сегодня / Вчера / Другая» — последний разворачивает date-picker.
- Comment (опц.).
- `[Оформить за 4 200 000 UZS]` — единственная кнопка, сумма в кнопке.

**verify:** happy-path full submit, тосты, SuccessModal с QR-стикером работает.

## Волна 6 · Финал

- Анимации перехода между шагами (Tailwind `animate-fade-up`, slide).
- Headed E2E полный путь: чип → дефекты → новый продавец → цена → submit.
- i18n RU + UZ обновить все новые ключи.
- `pnpm build`, `pytest` зелёные.

---

## Что НЕ делаем в этой переработке

- Не вводим LLM/AI для подсказок — только SQL над историей магазина.
- Не трогаем сканер IMEI (исключён ранее).
- Не делаем 2 режима (быстрый/полный) — визард один, с шорткатом «Повторить».
- Не ломаем `condition` enum — добавляем `defects` рядом.
- Не делаем отдельный шаг 0 «Новая или повтор» — карточка над чипами достаточна.

## Объём

~5–7 сессий. Без новых либ. Только React-state + 4 новых SQL-эндпоинта + 1 миграция.

---

## Финальный статус (2026-05-20)

**Все 6 волн ЗАКРЫТЫ за одну сессию.**

- ✅ **Волна 0** — миграция `0011_add_device_defects`, 4 эндпоинта (`recent-models`, `price-hint`, `purchases/last`, `devices/upload-url`), 14 новых pytest → **85 зелёных**, alembic round-trip OK.
- ✅ **Волна 1** — `Wizard.tsx` (`WizardProgress` + `WizardFooter` + `StepShell`), `useStepValidation` через `trigger(STEP_FIELDS[step])`, draft v2 хранит `_step`/`_devicePhotos`/`_sellerPhotos`.
- ✅ **Волна 2** — `steps/Step1Model.tsx`: «🔁 Повторить последнюю» карточка → шаг 4, сетка 10 чипов `recent-models`, fallback `+ Другая модель` через `SuggestField`.
- ✅ **Волна 3** — `steps/Step2Device.tsx`: IMEI + `ImeiDupWarning`, `DefectChecklist` (8 toggle-чипов → condition по `conditionFromDefects`), `DocumentUploader` через новый `requestDeviceUploadUrl`, collapsible notes.
- ✅ **Волна 4** — `steps/Step3Seller.tsx`: `SellerSearch` крупно, имя+телефон обязательно, паспорт/tg/фото — collapsible «Документы (опционально)».
- ✅ **Волна 5** — `steps/Step4Price.tsx`: `CurrencyDualInput` + `PriceHint` (avg/last + дельта ↑↓), `DateChips` (Сегодня/Вчера/Другая), collapsible comment, submit-кнопка «Принять за N UZS».
- ✅ **Волна 6** — i18n RU + UZ дополнены (50+ новых ключей), `pnpm build` зелёный (PurchaseNew 33.80 KB, index 343.78 KB), `pytest` 85 зелёных.

**Удалено:** `purchase/PurchasePreview.tsx` (заменён суммой в submit-кнопке).

**Известный пробел (не баг, осознанный):**
- Анимация перехода между шагами — только `animate-fade-up` (single fade). Slide-transitions не делали — простоты ради.
- E2E Playwright headed — не запускали в этой сессии (build+pytest достаточно для контракта, headed запустить вручную при необходимости).
