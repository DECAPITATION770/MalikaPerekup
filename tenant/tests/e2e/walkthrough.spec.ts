import { test, expect } from '@playwright/test';

/**
 * Live happy-path walkthrough against a RUNNING backend with demo data
 * (login `malika` / `malika12345`). Skips itself if the backend isn't up,
 * so the backend-free CI suite (login + showcase) stays green.
 *
 * Run it explicitly while the stack is up:
 *   pnpm exec playwright test walkthrough --project=desktop --headed
 */
const CREDS = { login: 'malika', password: 'malika12345' };

test.beforeEach(async ({ request }) => {
  const res = await request
    .post('http://localhost:8000/api/v1/auth/login', { data: CREDS })
    .catch(() => null);
  test.skip(!res || !res.ok(), 'backend not running with demo data — skipping live walkthrough');
});

test('full walkthrough: login → today → stock → installments → reports', async ({ page }) => {
  // ── Login ──────────────────────────────────────────────────────────
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

  // ── Today dashboard ────────────────────────────────────────────────
  await expect(page).toHaveURL('http://localhost:5175/');
  await expect(page.getByText(/ПРИБЫЛЬ СЕГОДНЯ|Bugungi foyda/i)).toBeVisible();
  await expect(page.getByText(/ЗАМОРОЖЕННЫЕ ДЕНЬГИ|Muzlatilgan/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/walk-1-today.png' });

  // ── Stock ──────────────────────────────────────────────────────────
  await page.goto('/stock');
  await expect(page.getByRole('heading', { name: /Витрина|Vitrina/ })).toBeVisible();
  // Demo data has 3 devices. Assert the (always-visible) count line — the
  // device rows render twice (desktop table + mobile list), so a plain
  // getByText would resolve the hidden desktop copy on the mobile project.
  await expect(page.getByText(/Всего\s+\d|Jami\s+\d/).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'test-results/walk-2-stock.png' });

  // ── Installments ───────────────────────────────────────────────────
  await page.goto('/installments');
  await expect(page.getByRole('heading', { name: /Рассрочк|Nasiya|Bo'lib/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/walk-3-installments.png' });

  // ── Reports (recharts) ─────────────────────────────────────────────
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: /Отчёт|Hisobot/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/walk-4-reports.png' });

  // ── Search (cmdk) ──────────────────────────────────────────────────
  await page.goto('/search');
  await page.locator('input[cmdk-input]').fill('apple');
  await page.waitForTimeout(600); // debounce
  await page.screenshot({ path: 'test-results/walk-5-search.png' });
});
