import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';

/**
 * /_dev/showcase renders every primitive + decorative variant. It's our
 * WCAG 2 A/AA contrast gate for BOTH themes (dark default + light) — the
 * full palette was tuned against this page, so a regression here means a
 * token drifted out of contrast.
 */
function axeGate(scheme: 'dark' | 'light') {
  test(`showcase passes WCAG 2 A/AA (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/_dev/showcase');
    await page.evaluate((s) => document.documentElement.classList.toggle('light', s === 'light'), scheme);
    await page.waitForTimeout(400);

    await expect(page.getByText('Custom icons')).toBeVisible();
    // Freeze animations so axe never samples an element mid fade-up (partial
    // opacity reads as low contrast and flakes under parallel load).
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important}',
    });
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    expect(
      violations,
      JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))),
    ).toHaveLength(0);
  });
}

axeGate('dark');
axeGate('light');

test('theme toggle flips light/dark', async ({ page }) => {
  await page.goto('/_dev/showcase');
  const html = page.locator('html');
  const before = await html.getAttribute('class');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  const after = await html.getAttribute('class');
  expect(after).not.toBe(before);
});
