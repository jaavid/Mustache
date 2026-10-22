import { test, expect, type Page } from '@playwright/test';

type Payload = {
  name?: string;
  url: string;
  referrer: string;
  title: string;
  data?: Record<string, unknown>;
};
declare global {
  interface Window {
    __analyticsTestPayloads: Payload[];
    __analyticsScriptLocation: string;
  }
}

const token = 'a'.repeat(64);
const origin = 'https://mustache.alexa.ir';

/** Serve local game code under a mocked production origin; never contact production. */
async function mockProduction(page: Page, blocked = false): Promise<void> {
  await page.route('**/*', (route) => route.abort());
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/@vite/client') {
      // Preserve Vite's imported API without opening an HMR socket to the mocked host.
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
        export function createHotContext() { return new Proxy({ data: {} }, { get: (value, key) => value[key] ?? (() => {}) }); }
        const styles = new Map();
        export function updateStyle(id, css) {
          let style = styles.get(id);
          if (!style) { style = document.createElement('style'); styles.set(id, style); document.head.appendChild(style); }
          style.textContent = css;
        }
        export function removeStyle(id) { styles.get(id)?.remove(); styles.delete(id); }
        export function injectQuery(url) { return url; }
      `,
      });
      return;
    }
    const response = await route.fetch({
      url: `http://127.0.0.1:4173${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.route('https://telegram.org/js/games.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );
  await page.route('https://mustache.zedai.ir/**', (route) =>
    route.fulfill({
      status: route.request().url().endsWith('/api/round/start') ? 200 : 400,
      json: route.request().url().endsWith('/api/round/start')
        ? { roundId: 'mock-round' }
        : { error: 'SCORE_MISMATCH' },
    }),
  );
  await page.route('https://stats.tamin24.ir/script.js', (route) => {
    if (blocked) return route.abort();
    return route.fulfill({
      contentType: 'application/javascript',
      body: `
      window.__analyticsScriptLocation = location.href;
      window.__analyticsTestPayloads = [];
      window.umami = { track(callback) {
        window.__analyticsTestPayloads.push(callback({
          website: 'wrong', hostname: location.hostname, screen: '540x960', language: 'fa',
          url: location.href, title: 'PRIVATE PLAYER', referrer: 'https://t.me/private?token=secret',
          data: { private: 'PRIVATE PLAYER' }
        }));
        return Promise.resolve();
      }};
    `,
    });
  });
}

async function events(page: Page): Promise<Payload[]> {
  return page.evaluate(() => window.__analyticsTestPayloads ?? []);
}

async function enterRound(page: Page, mobile: boolean): Promise<void> {
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw Error('Missing canvas');
  await page.mouse.click(
    box.x + box.width * (mobile ? 0.5 : 305 / 960),
    box.y + box.height * (mobile ? 792 / 960 : 385 / 540),
  );
  await expect
    .poll(async () => (await events(page)).some((event) => event.name === 'character_select_view'))
    .toBe(true);
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await events(page)).some((event) => event.name === 'tutorial_start'))
    .toBe(true);
  await page.mouse.click(
    box.x + box.width * (mobile ? 125 / 540 : 300 / 960),
    box.y + box.height * (mobile ? 769 / 960 : 451 / 540),
  );
  await expect
    .poll(async () => (await events(page)).some((event) => event.name === 'round_start'))
    .toBe(true);
}

test('real bootstrap and UI emit scrubbed analytics under a mocked production origin', async ({
  page,
}, info) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await mockProduction(page);
  await page.goto(
    `${origin}/?tg_session=${token}&utm_source=telegram&utm_campaign=group_test#private`,
  );
  expect(errors).toEqual([]);
  await expect
    .poll(async () => (await events(page)).some((event) => event.name === 'game_ready'))
    .toBe(true);
  expect(await page.evaluate(() => window.__analyticsScriptLocation)).not.toContain(token);
  expect(
    await page
      .locator('script[src="https://stats.tamin24.ir/script.js"]')
      .getAttribute('data-auto-track'),
  ).toBe('false');
  await enterRound(page, info.project.name === 'mobile-portrait');
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => (await events(page)).some((event) => event.name === 'round_end'))
    .toBe(true);
  await expect
    .poll(async () => (await events(page)).some((event) => event.name === 'score_submit'))
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await events(page)).filter((event) => event.name === 'round_start').length)
    .toBe(2);

  const captured = await events(page);
  expect(captured.filter((event) => !event.name)).toHaveLength(1);
  expect(captured.filter((event) => event.name === 'game_ready')).toHaveLength(1);
  expect(captured.filter((event) => event.name === 'round_end')).toHaveLength(1);
  expect(captured.filter((event) => event.name === 'round_abandon')).toHaveLength(0);
  expect(captured.find((event) => event.name === 'round_end')?.data).toMatchObject({
    reason: 'early_exit',
    character: 'mammad',
    layout: info.project.name === 'desktop' ? 'landscape' : 'portrait',
  });
  expect(captured.find((event) => event.name === 'score_submit')?.data).toMatchObject({
    outcome: 'unavailable',
    error_category: 'validation',
  });
  for (const payload of captured)
    expect(payload).toMatchObject({ url: '/', referrer: '', title: 'N5 Mustache Mayhem' });
  expect(JSON.stringify(captured)).not.toMatch(
    new RegExp(`${token}|tg_session|PRIVATE PLAYER|#private|t\\.me`),
  );
  expect(requests.some((url) => url.includes('recorder.js'))).toBe(false);
  expect(errors).toEqual([]);
});

test('blocked analytics never prevents the game from booting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockProduction(page, true);
  await page.goto(`${origin}/`);
  expect(errors).toEqual([]);
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(1300);
  expect(await events(page)).toEqual([]);
  expect(errors).toEqual([]);
});
