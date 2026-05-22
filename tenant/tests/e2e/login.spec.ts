import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';

/**
 * Login renders without a backend: brand wordmark + password form. The
 * Telegram autologin path is skipped outside TG, so we land on the
 * password fallback directly. This real product screen is also our WCAG
 * 2 A/AA a11y gate (dark default theme).
 */
test('login page renders brand + password form', async ({ page }) => {
  await page.goto('/login');

  // Brand wordmark (SVG with aria-label="Малика")
  await expect(page.getByRole('img', { name: 'Малика' }).first()).toBeVisible();

  // Login + password inputs
  await expect(page.getByPlaceholder('ivan_kupez')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();

  // Submit button
  await expect(page.getByRole('button', { name: /Войти|Kirish/ })).toBeVisible();
});

test('password form validates min length', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('ivan_kupez').fill('ab'); // too short
  await page.locator('#password').fill('123'); // too short
  await page.getByRole('button', { name: /Войти|Kirish/ }).click();
  // zod errors surface as role=alert
  await expect(page.getByRole('alert').first()).toBeVisible();
});

test.describe('a11y', () => {
  test.use({ colorScheme: 'dark' });
  test('login passes WCAG 2 A/AA (dark)', async ({ page }) => {
    await page.goto('/login');
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    expect(violations, JSON.stringify(violations.map((v) => v.id))).toHaveLength(0);
  });
});
