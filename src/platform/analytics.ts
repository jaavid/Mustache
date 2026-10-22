import { version } from '../../package.json';
import { getSelectedGameMode } from '../logic/gameMode';
import { getSelectedCharacter } from '../game/characterChoice';

const WEBSITE_ID = '71429b79-9586-4ec3-ad7a-8ab00e8ac68e';
const SCRIPT_URL = 'https://stats.tamin24.ir/script.js';
const VISIT_KEY = 'mustache-analytics-last-visit-v1';
const MAX_QUEUE = 60;

export const ANALYTICS_EVENTS = [
  'session_start',
  'game_ready',
  'asset_load_failed',
  'client_error',
  'layout_change',
  'menu_view',
  'play_click',
  'character_select_view',
  'character_selected',
  'character_confirm',
  'tutorial_start',
  'tutorial_step',
  'tutorial_end',
  'round_start',
  'first_shot',
  'round_checkpoint',
  'round_end',
  'round_abandon',
  'replay_click',
  'pause',
  'resume',
  'share_click',
  'share_result',
  'profile_view',
  'invite_click',
  'invite_result',
  'gold_rush_click',
  'leaderboard_view',
  'leaderboard_filter',
  'leaderboard_result',
  'golden_pickup',
  'golden_ready',
  'golden_used',
  'score_submit',
  'round_start_result',
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsData = Record<string, string | number | boolean>;
type Payload = Record<string, unknown>;
type Tracker = { track: (payload: (defaults: Payload) => Payload) => unknown };

declare global {
  interface Window {
    umami?: Tracker;
  }
}

// Runtime allowlists: caller mistakes must not send names, URLs, tokens or arbitrary errors.
const TEXT_FIELDS: Record<string, readonly string[]> = {
  layout: ['portrait', 'landscape', 'desktop', 'mobile'],
  mode: ['classic', 'goldRush', 'combined'],
  character: ['ramin', 'borhan', 'mammad'],
  source: [
    'menu',
    'results',
    'manual',
    'visibility',
    'keyboard',
    'pointer',
    'timer',
    'ready',
    'timeout',
  ],
  filter: ['day', 'week', 'month', 'all', 'chat', 'telegram'],
  reason: [
    'completed',
    'early_exit',
    'shutdown',
    'pagehide',
    'replaced',
    'skipped',
    'timeout',
    'ready',
    'keyboard',
    'manual',
    'visibility',
  ],
  method: ['pointer', 'keyboard', 'timeout', 'ready', 'manual', 'visibility'],
  outcome: [
    'opened',
    'completed',
    'skipped',
    'started',
    'copied',
    'prompted',
    'cancelled',
    'failed',
    'loaded',
    'saved',
    'local',
    'unavailable',
  ],
  channel: ['telegram', 'native', 'clipboard', 'prompt'],
  state: ['locked', 'ticket_confirmation', 'available', 'saved', 'local', 'unavailable'],
  status: ['locked', 'ticket_confirmation', 'available', 'loaded', 'failed', 'unavailable'],
  period: ['day', 'week', 'month', 'all', 'chat'],
  grade: ['perfect', 'good', 'miss'],
  error_category: ['network', 'authentication', 'validation', 'server', 'unknown'],
  telegram_state: ['updated', 'previous_best', 'retry', 'pending', 'none'],
  error_type: ['runtime', 'unhandled_rejection', 'asset'],
};
const NUMBER_FIELDS: Record<string, number> = {
  score: 100000,
  ranked_score: 100000,
  shots: 1000,
  perfect: 1000,
  good: 1000,
  miss: 1000,
  max_combo: 1000,
  accuracy: 100,
  accuracy_pct: 100,
  elapsed_ms: 3600000,
  active_elapsed_ms: 3600000,
  duration_ms: 3600000,
  load_ms: 3600000,
  round_number: 10000,
  checkpoint: 45,
  checkpoint_seconds: 45,
  seconds: 45,
  step: 3,
  week_offset: 1000,
  count: 1000,
  collected: 3,
  index: 10,
  offset: 1000,
  golden_pickups: 5,
  golden_perfect: 80,
  missions_completed: 3,
  new_badges: 5,
};
const BOOLEAN_FIELDS = new Set([
  'golden',
  'ready',
  'available',
  'authenticated',
  'automatic',
  'unlocked',
  'ticket',
  'golden_shot',
]);

export function sanitizeAnalyticsData(data: AnalyticsData = {}): AnalyticsData {
  const clean: AnalyticsData = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && TEXT_FIELDS[key]?.includes(value)) clean[key] = value;
    else if (
      typeof value === 'number' &&
      Object.hasOwn(NUMBER_FIELDS, key) &&
      Number.isFinite(value)
    ) {
      // Keep low-cardinality aggregates, not fractional coordinates or arbitrary identifiers.
      clean[key] = Math.round(Math.min(NUMBER_FIELDS[key], Math.max(0, value)));
    } else if (typeof value === 'boolean' && BOOLEAN_FIELDS.has(key)) clean[key] = value;
  }
  return clean;
}

let readyReported = false;
let initializedAt = Date.now();
export function trackGameReady(portrait: boolean): void {
  if (readyReported) return;
  readyReported = true;
  trackEvent('game_ready', {
    layout: portrait ? 'portrait' : 'landscape',
    load_ms: Date.now() - initializedAt,
  });
}

let initialized = false;
let enabled = false;
let loaded = false;
let launch = 'browser';
let queue: Array<{ name?: AnalyticsEvent; data?: AnalyticsData }> = [];
let sessionContext: AnalyticsData = {};
const common = () => ({ app_version: version, schema_version: 1, launch, ...sessionContext });

function acquisition(): AnalyticsData {
  const params = new URLSearchParams(window.location.search);
  const sources = ['telegram', 'instagram', 'google', 'youtube', 'x', 'discord', 'friend'];
  const campaigns = ['launch', 'daily_challenge', 'friend_challenge', 'group_test', 'organic'];
  const source = params.get('utm_source') || '';
  const campaign = params.get('utm_campaign') || '';
  // Only explicitly named campaign labels, never arbitrary query values/referral IDs.
  return {
    acquisition_source: sources.includes(source)
      ? source
      : launch === 'official_telegram'
        ? 'telegram'
        : 'direct_or_other',
    campaign: campaigns.includes(campaign) ? campaign : 'none',
  };
}

function privacyDisabled(): boolean {
  try {
    return (
      navigator.doNotTrack === '1' ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
      localStorage.getItem('umami.disabled') === '1' ||
      localStorage.getItem('umami.disabled') === 'true'
    );
  } catch {
    return true; // Storage/browser privacy restrictions fail closed.
  }
}

function send(event: { name?: AnalyticsEvent; data?: AnalyticsData }): void {
  if (privacyDisabled()) {
    queue = [];
    return;
  }
  try {
    // Use Umami's callback API for *every* pageview/event. Never let it infer a
    // URL, query, hash, referrer or title from a Telegram launch or profile UI.
    const result = window.umami?.track((defaults) => ({
      website: WEBSITE_ID,
      hostname: window.location.hostname,
      screen: defaults.screen,
      language: defaults.language,
      url: '/',
      referrer: '',
      title: 'N5 Mustache Mayhem',
      ...(event.name ? { name: event.name, data: { ...common(), ...event.data } } : {}),
    }));
    // Tracker failure must never create an unhandled rejection or block gameplay.
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).catch(() => undefined);
    }
  } catch {
    /* Analytics is always optional. */
  }
}

function enqueue(event: { name?: AnalyticsEvent; data?: AnalyticsData }): void {
  if (!enabled) return;
  if (loaded) send(event);
  else if (queue.length < MAX_QUEUE) queue.push(event);
}

export function trackEvent(name: AnalyticsEvent, data: AnalyticsData = {}): void {
  try {
    if (!ANALYTICS_EVENTS.includes(name)) return;
    enqueue({
      name,
      data: sanitizeAnalyticsData({
        mode: getSelectedGameMode(),
        character: getSelectedCharacter(),
        ...data,
      }),
    });
  } catch {
    /* Invalid payloads or unavailable browser APIs must not affect play. */
  }
}

function visitCohort(): { visit_type: string; return_gap: string } {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const previous = localStorage.getItem(VISIT_KEY);
    localStorage.setItem(VISIT_KEY, today);
    if (!previous) return { visit_type: 'new', return_gap: 'first' };
    const gap = Math.floor((Date.parse(today) - Date.parse(previous)) / 86400000);
    if (!Number.isFinite(gap) || gap < 0) return { visit_type: 'unknown', return_gap: 'unknown' };
    return {
      visit_type: gap === 0 ? 'same_day' : 'returning',
      return_gap:
        gap === 0
          ? 'same_day'
          : gap === 1
            ? 'one_day'
            : gap <= 7
              ? 'two_to_seven_days'
              : gap <= 30
                ? 'eight_to_thirty_days'
                : 'over_thirty_days',
    };
  } catch {
    return { visit_type: 'unknown', return_gap: 'unknown' };
  }
}

/** Called after the competitive bridge has consumed/removed the bearer token. */
export function initAnalytics(options: { telegramSession: boolean }): void {
  if (initialized) return;
  initialized = true;
  initializedAt = Date.now();
  try {
    // Never pollute production stats from local development or browser smoke tests.
    if (
      !['mustache.alexa.ir', 'jaavid.github.io'].includes(window.location.hostname) ||
      privacyDisabled()
    )
      return;
    enabled = true;
    launch = options.telegramSession ? 'official_telegram' : 'browser';
    sessionContext = { ...visitCohort(), ...acquisition() };
    enqueue({}); // Exactly one manual, scrubbed pageview per page load.
    enqueue({ name: 'session_start' });
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.defer = true;
    script.dataset.websiteId = WEBSITE_ID;
    script.dataset.autoTrack = 'false';
    script.dataset.doNotTrack = 'true';
    script.dataset.excludeSearch = 'true';
    script.dataset.excludeHash = 'true';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      if (!window.umami?.track) {
        enabled = false;
        queue = [];
        return;
      }
      loaded = true;
      const pending = queue;
      queue = [];
      for (const event of pending) send(event);
    };
    script.onerror = () => {
      enabled = false;
      queue = [];
    };
    document.head.appendChild(script);

    // Categorical, rate-limited diagnostics. Never send message, stack or resource URL.
    const reported = new Set<string>();
    const report = (errorType: 'runtime' | 'unhandled_rejection') => {
      if (reported.has(errorType)) return;
      reported.add(errorType);
      trackEvent('client_error', { error_type: errorType });
    };
    window.addEventListener('error', () => report('runtime'));
    window.addEventListener('unhandledrejection', () => report('unhandled_rejection'));
  } catch {
    enabled = false;
    queue = [];
  }
}
