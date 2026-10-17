import { test, expect } from '@playwright/test';

test('CC0 forest candidates render from real PNG files and spruce sheet frame', async ({ page }) => {
  await page.goto('/forest-asset-review.html');
  await expect(page.getByRole('heading', { name: /Forest Asset Review/ })).toBeVisible();
  for (const id of ['oak', 'willow']) {
    const img = page.locator('#' + id);
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('#cedar')).toHaveAttribute('data-loaded', 'true');
  await expect(page.locator('#cedar-scene')).toHaveAttribute('data-loaded', 'true');
  const nonTransparent = await page.locator('#cedar').evaluate((el: HTMLCanvasElement) => {
    const pixels = el.getContext('2d')!.getImageData(0, 0, 74, 128).data;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return true;
    return false;
  });
  expect(nonTransparent).toBe(true);
  await page.screenshot({ path: 'test-results/forest-assets-' + test.info().project.name + '.png', fullPage: true });
});
