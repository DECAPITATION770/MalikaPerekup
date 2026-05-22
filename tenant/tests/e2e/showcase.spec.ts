import { test, expect } from '@playwright/test';

/**
 * /_dev/showcase is the kitchen-sink dev page rendering every primitive +
 * decorative variant. We smoke-render it and verify the theme toggle —
 * the axe a11y gate runs against the real Login screen (login.spec.ts),
 * not this stress page full of decorative chips.
 */
test('showcase renders all sections', async ({ page }) => {
  await page.goto('/_dev/showcase');
  await expect(page.getByText('Custom icons')).toBeVisible();
  await expect(page.getByText('Buttons')).toBeVisible();
  await expect(page.getByText('KpiCard')).toBeVisible();
  await expect(page.getByText('Illustrations')).toBeVisible();
});

test('theme toggle flips light/dark', async ({ page }) => {
  await page.goto('/_dev/showcase');
  const html = page.locator('html');
  const before = await html.getAttribute('class');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  const after = await html.getAttribute('class');
  expect(after).not.toBe(before);
});
