import { test, expect } from '@playwright/test';

test('loads pixel-art scene and enters play in desktop and portrait layouts', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        return [c.width, c.height].join('x');
      }),
    )
    .toBe(info.project.name === 'desktop' ? '960x540' : '540x960');

  await page.waitForTimeout(1300);
  await canvas.screenshot({ path: info.outputPath('menu.png') });

  // The first-run tutorial may appear immediately on Play; that is expected.
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const isMobile = info.project.name !== 'desktop';
  await page.mouse.click(
    box.x + box.width * (isMobile ? 0.5 : 305 / 960),
    box.y + box.height * (isMobile ? 792 / 960 : 385 / 540),
  );

  // Select Borhan via the same keyboard controls in both layouts, then launch.
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: info.outputPath('character-select.png') });
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await expect(canvas).toBeVisible();
  await canvas.screenshot({ path: info.outputPath('started.png') });
  expect(errors).toEqual([]);
});
