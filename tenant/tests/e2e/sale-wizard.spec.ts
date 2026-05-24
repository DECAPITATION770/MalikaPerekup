import { test, expect } from '@playwright/test';

/**
 * Live e2e for the UX pass: the new 2-step sale wizard + the Today dedupe.
 * Needs a RUNNING backend with demo data (login `malika` / `malika12345`);
 * skips itself otherwise so the backend-free CI suite stays green.
 *
 * Watch it run in Chromium:
 *   pnpm exec playwright test sale-wizard --project=mobile --headed
 */
const CREDS = { login: 'malika', password: 'malika12345' };

test.beforeEach(async ({ request }) => {
  const res = await request
    .post('http://localhost:8000/api/v1/auth/login', { data: CREDS })
    .catch(() => null);
  test.skip(!res || !res.ok(), 'backend not running with demo data — skipping live e2e');
});

async function login(page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('tenant_token');
    localStorage.removeItem('tenant_user');
    localStorage.removeItem('tenant_manual_logout');
  });
  await page.goto('/login');
  await page.locator('#login').fill(CREDS.login);
  await page.locator('#password').fill(CREDS.password);
  await page.getByRole('button', { name: /Войти|Kirish/ }).click();
  await expect(page).toHaveURL('http://localhost:5175/');
}

test('Today quick actions are deduped to Контрагенты + Каталог', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: /Быстрые действия|Tezkor/ })).toBeVisible();
  // The two destinations without a persistent nav slot:
  await expect(page.getByRole('link', { name: /Контрагенты|Kontragent/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Номенклатура|Nomenklatura/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/sale-0-today.png' });
});

test('sale wizard: device → deal → nasiya', async ({ page }) => {
  await login(page);

  // ── Step 1: device ─────────────────────────────────────────────────
  await page.goto('/sale/new');
  await expect(page.getByRole('heading', { name: /Что продаёте|Nima sotyapsiz/ })).toBeVisible();
  // Step bar shows both steps
  await expect(page.getByRole('button', { name: /Устройство|Qurilma/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Сделка|Bitim/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/sale-1-device.png' });

  // Pick an in-stock device (the select button carries the model name)
  await page.getByRole('button', { name: /iPhone 14 Pro/ }).first().click();
  // It collapses to the chosen-device bar with a «change» control
  await expect(page.getByRole('button', { name: /Изменить|Oʻzgartirish/ })).toBeVisible();

  // ── Step 2: deal ───────────────────────────────────────────────────
  await page.getByRole('button', { name: /Далее|Keyingi/ }).click();
  await expect(page.getByRole('heading', { name: /^Сделка$|^Bitim$/ })).toBeVisible();
  // Device reminder chip carried into step 2
  await expect(page.getByText(/iPhone 14 Pro/).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/sale-2-deal.png' });

  // ── Nasiya: docs auto-expand + schedule appears ────────────────────
  // RU label is «Рассрочка» (CLAUDE.md §15 — «Nasiya» only in UZ).
  await page.getByRole('button', { name: /^Рассрочка$|^Nasiya$/ }).click();
  await expect(page.getByText(/График рассрочки|Nasiya jadvali/i)).toBeVisible();
  // Submit label switches to the installment variant
  await expect(
    page.getByRole('button', { name: /Оформить рассрочку|Nasiya rasmiylashtirish/ }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/sale-3-nasiya.png' });
});
