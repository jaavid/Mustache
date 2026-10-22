import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Payload = Record<string, unknown>;
type Script = {
  src: string;
  defer: boolean;
  dataset: Record<string, string>;
  referrerPolicy: string;
  onload?: () => void;
  onerror?: () => void;
};
let scripts: Script[];
let payloads: Payload[];
let storage: Map<string, string>;
let listeners: Record<string, () => void>;
let location: { hostname: string; search: string };
const secret = 'a'.repeat(64);

beforeEach(() => {
  vi.resetModules();
  scripts = [];
  payloads = [];
  listeners = {};
  storage = new Map();
  location = {
    hostname: 'mustache.alexa.ir',
    search: `?tg_session=${secret}&utm_source=telegram&utm_campaign=launch`,
  };
  vi.stubGlobal('navigator', { doNotTrack: '0' });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal('window', {
    location,
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn;
    },
  });
  vi.stubGlobal('document', {
    title: 'PRIVATE PLAYER NAME',
    referrer: 'https://t.me/private?token=secret',
    createElement: () => ({ dataset: {} }),
    head: { appendChild: (script: Script) => scripts.push(script) },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function loadTracker(track?: (callback: (defaults: Payload) => Payload) => unknown): void {
  window.umami = {
    track:
      track ??
      ((callback) => {
        payloads.push(
          callback({
            website: 'wrong',
            hostname: location.hostname,
            screen: '1920x1080',
            language: 'fa',
            url: `/?tg_session=${secret}#private`,
            referrer: document.referrer,
            title: document.title,
            data: { name: 'PRIVATE PLAYER NAME' },
            unknown: 'private',
          }),
        );
        return Promise.resolve();
      }),
  };
  scripts[0].onload?.();
}

const eventData = (name: string) =>
  payloads.find((payload) => payload.name === name)?.data as Record<string, unknown>;

describe('privacy-safe optional Umami analytics', () => {
  it('loads only the event tracker, disables automatic tracking and initializes once', async () => {
    const { initAnalytics } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: true });
    initAnalytics({ telegramSession: true });
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      src: 'https://stats.tamin24.ir/script.js',
      defer: true,
      referrerPolicy: 'no-referrer',
      dataset: {
        websiteId: '71429b79-9586-4ec3-ad7a-8ab00e8ac68e',
        autoTrack: 'false',
        doNotTrack: 'true',
        excludeSearch: 'true',
        excludeHash: 'true',
      },
    });
    expect(payloads).toHaveLength(0);
    loadTracker();
    expect(payloads).toHaveLength(2);
    expect(payloads.filter((payload) => !payload.name)).toHaveLength(1);
    expect(eventData('session_start')).toMatchObject({
      launch: 'official_telegram',
      visit_type: 'new',
      acquisition_source: 'telegram',
      campaign: 'launch',
    });
  });

  it('scrubs every pageview and event including tracker-generated default URL/title/referrer/data', async () => {
    const { initAnalytics, trackEvent } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: true });
    trackEvent('round_end', {
      score: 350,
      shots: 3,
      active_elapsed_ms: 45000,
      checkpoint_seconds: 30,
      reason: 'completed',
      token: secret,
      url: location.search,
      name: 'PRIVATE PLAYER NAME',
      character: 'ramin',
      mode: 'classic',
    });
    loadTracker();
    for (const payload of payloads) {
      expect(payload).toMatchObject({ url: '/', referrer: '', title: 'N5 Mustache Mayhem' });
      expect(payload).not.toHaveProperty('unknown');
    }
    const serialized = JSON.stringify(payloads);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(/PRIVATE PLAYER NAME|tg_session|t\.me|#private|token=/);
    expect(eventData('round_end')).toMatchObject({
      score: 350,
      shots: 3,
      active_elapsed_ms: 45000,
      checkpoint_seconds: 30,
      reason: 'completed',
    });
  });

  it('only accepts bounded allowlisted data, preserves categorical UI props and drops arbitrary values', async () => {
    const { sanitizeAnalyticsData } = await import('../../platform/analytics');
    expect(
      sanitizeAnalyticsData({
        layout: 'portrait',
        character: 'borhan',
        mode: 'goldRush',
        source: 'timeout',
        filter: 'telegram',
        outcome: 'prompted',
        status: 'unavailable',
        score: 999999999,
        shots: -1,
        accuracy: 75.3,
        max_combo: Infinity,
        duration_ms: NaN,
        token: secret,
        unknown: 'manual',
        reason: secret,
        available: true,
        telegram_user_id: 123,
      }),
    ).toEqual({
      layout: 'portrait',
      character: 'borhan',
      mode: 'goldRush',
      source: 'timeout',
      filter: 'telegram',
      outcome: 'prompted',
      status: 'unavailable',
      score: 100000,
      shots: 0,
      accuracy: 75,
      available: true,
    });
  });

  it('bounds the pending queue even when the tracker is blocked indefinitely', async () => {
    const { initAnalytics, trackEvent } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: false });
    for (let i = 0; i < 200; i++) trackEvent('menu_view', { round_number: i });
    loadTracker();
    expect(payloads).toHaveLength(60);
    expect(payloads[0]).not.toHaveProperty('name');
  });

  it('never throws or retries after script failure or missing tracker API', async () => {
    const { initAnalytics, trackEvent } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: false });
    scripts[0].onerror?.();
    expect(() => trackEvent('round_start')).not.toThrow();
    expect(payloads).toHaveLength(0);
    scripts[0].onload?.();
    trackEvent('round_end');
    expect(payloads).toHaveLength(0);
    expect(scripts).toHaveLength(1);
  });

  it('isolates synchronous tracker errors and rejected promises from gameplay', async () => {
    const { initAnalytics, trackEvent } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: false });
    loadTracker(() => {
      throw new Error('tracker blocked');
    });
    expect(() => trackEvent('round_start')).not.toThrow();
    window.umami = { track: () => Promise.reject(new Error('tracker blocked')) };
    expect(() => trackEvent('round_end')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it.each([{ doNotTrack: '1' }, { globalPrivacyControl: true }])(
    'honors browser privacy signal %j before loading or storing visit data',
    async (signal) => {
      vi.stubGlobal('navigator', signal);
      const { initAnalytics } = await import('../../platform/analytics');
      initAnalytics({ telegramSession: false });
      expect(scripts).toHaveLength(0);
      expect(storage.size).toBe(0);
    },
  );

  it('honors persistent opt-out and rechecks it after loading', async () => {
    storage.set('umami.disabled', '1');
    let adapter = await import('../../platform/analytics');
    adapter.initAnalytics({ telegramSession: false });
    expect(scripts).toHaveLength(0);
    vi.resetModules();
    storage.delete('umami.disabled');
    adapter = await import('../../platform/analytics');
    adapter.initAnalytics({ telegramSession: false });
    loadTracker();
    const before = payloads.length;
    storage.set('umami.disabled', 'true');
    adapter.trackEvent('round_start');
    expect(payloads).toHaveLength(before);
  });

  it('fails closed when storage access throws and does not load on local/preview hosts', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw Error('storage denied');
      },
    });
    const { initAnalytics } = await import('../../platform/analytics');
    expect(() => initAnalytics({ telegramSession: false })).not.toThrow();
    expect(scripts).toHaveLength(0);
    vi.resetModules();
    location.hostname = 'localhost';
    const localAdapter = await import('../../platform/analytics');
    localAdapter.initAnalytics({ telegramSession: false });
    expect(scripts).toHaveLength(0);
  });

  it('uses only known campaign labels and a date-only non-identifying return cohort', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
    storage.set('mustache-analytics-last-visit-v1', '2026-10-21');
    location.search = `?utm_source=${secret}&utm_campaign=PRIVATE_PLAYER`;
    const { initAnalytics } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: false });
    loadTracker();
    expect(eventData('session_start')).toMatchObject({
      visit_type: 'returning',
      return_gap: 'one_day',
      acquisition_source: 'direct_or_other',
      campaign: 'none',
    });
    expect(storage.get('mustache-analytics-last-visit-v1')).toBe('2026-10-22');
    expect(JSON.stringify(payloads)).not.toContain(secret);
  });

  it('snapshots mode/character when queuing an event, not when the script finally loads', async () => {
    const { setSelectedGameMode } = await import('../gameMode');
    const { setSelectedCharacter } = await import('../../game/characterChoice');
    const { initAnalytics, trackEvent } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: false });
    trackEvent('share_click', { layout: 'landscape' });
    setSelectedGameMode('goldRush');
    setSelectedCharacter('borhan');
    loadTracker();
    expect(eventData('share_click')).toMatchObject({ mode: 'classic', character: 'ramin' });
  });

  it('rate limits diagnostics and never forwards raw errors, resource URLs, or stacks', async () => {
    const { initAnalytics, trackGameReady } = await import('../../platform/analytics');
    initAnalytics({ telegramSession: false });
    loadTracker();
    listeners.error();
    listeners.error();
    listeners.unhandledrejection();
    listeners.unhandledrejection();
    trackGameReady(true);
    trackGameReady(false);
    expect(payloads.filter((p) => p.name === 'client_error')).toHaveLength(2);
    expect(payloads.filter((p) => p.name === 'game_ready')).toHaveLength(1);
  });
});
