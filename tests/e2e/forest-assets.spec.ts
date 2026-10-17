import { test, expect } from '@playwright/test';

test('game launches with the licensed two-species forest art', async ({ page }) => {
  const failed: string[] = [];
  page.on('pageerror', error => failed.push(error.message));
  await page.goto('/');
  const canvas = page.locator('#game canvas').first();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1250);
  expect(failed).toEqual([]);
  await page.screenshot({
    path: 'test-results/forest-scene-' + test.info().project.name + '.png',
    fullPage: true,
  });
});
