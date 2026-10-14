import { getSelectedGameMode, type GameMode } from '../logic/gameMode';

/**
 * Official Game backend bridge. Standalone browser visitors keep local scores.
 * Telegram identities come ONLY from server-issued callback session tokens.
 */
// Both endpoints route to the same Cloudflare Worker/D1. The stable workers.dev
// hostname provides an emergency fallback if the custom domain loses its route.
const API_HOSTS = [
  'https://mustache.zedai.ir',
  'https://n5-mustache-rjttobot.zed-ai.workers.dev',
] as const;
let preferredApiHost: string = API_HOSTS[0];
type Aim = { x: number; y: number };
type Variant = 'normal' | 'sunglasses' | 'round' | 'headband' | 'gold';
type Trace = {
  tMs: number;
  aim: Aim;
  lip: Aim;
  variant: Variant;
  comboBefore: number;
  goldenShot?: boolean;
};
type GoldenPickup = { index: number; tMs: number; aim: Aim };
export type Leader = {
  rank: number;
  name: string;
  score: number;
  goldenPerfect?: number;
  baseScore?: number;
  boostPoints?: number;
};
export type Period = 'day' | 'week' | 'month' | 'all';
export type Board = {
  mode?: GameMode;
  rival?: Leader | null;
  period: Period;
  offset: number;
  timeZone: string;
  start: number | null;
  end: number | null;
  startLabel: string;
  endLabel: string | null;
  remainingSeconds: number | null;
  playerCount: number;
  players: Leader[];
  me?: Leader | null;
};
export type PlayerProfile = {
  name: string;
  xp: number;
  level: number;
  nextLevelXp: number;
  roundsPlayed: number;
  activeDays: number;
  bestScore: number;
  bestClassic: number;
  bestGoldRush: number;
  goldenPerfects: number;
  dailyInvites: number;
  goldUnlocked: boolean;
  goldTicketEligible: boolean;
  goldRushAvailable: boolean;
  missions: Array<{ id: string; title: string; current: number; target: number; done: boolean }>;
  rank: number | null;
  weeklyScore?: number;
  rival?: Leader | null;
  inviteUrl: string;
};
export type Submission = {
  mode?: GameMode;
  rankedScore?: number;
  referralBonus?: number;
  state: 'local' | 'saved' | 'unavailable';
  error?: string;
  telegramSynced?: boolean;
  telegramState?: 'updated' | 'previous_best' | 'retry' | 'pending';
  telegramScores?: Leader[];
  board?: Board;
};

const sessionToken = (() => {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('tg_session');
  if (!value || !/^[0-9a-f]{64}$/.test(value)) return null;
  params.delete('tg_session');
  const query = params.toString();
  // Remove the bearer token from browser history and future Referer headers.
  window.history.replaceState(
    null,
    '',
    window.location.pathname + (query ? '?' + query : '') + window.location.hash,
  );
  return value;
})();

export class ScoreApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ScoreApiError';
  }
}

async function requestScoreApi(path: string, init: RequestInit): Promise<Response> {
  const orderedHosts = [preferredApiHost, ...API_HOSTS.filter((host) => host !== preferredApiHost)];
  let lastCode = 'NETWORK_OR_CORS';
  for (const host of orderedHosts) {
    try {
      const response = await fetch(host + path, init);
      if ([404, 502, 503, 504].includes(response.status)) {
        lastCode = 'HTTP_' + response.status;
        continue;
      }
      preferredApiHost = host;
      return response;
    } catch {
      lastCode = 'NETWORK_OR_CORS';
    }
  }
  throw new ScoreApiError(lastCode);
}

/** Server status is not synonymous with the server being offline. */
async function api(path: string, payload: unknown) {
  const response = await requestScoreApi(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sessionToken },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const serverCode = body && typeof body.error === 'string' ? body.error : '';
    const safeCode = /^[A-Z][A-Z0-9_]{2,60}$/.test(serverCode)
      ? serverCode
      : 'HTTP_' + response.status;
    throw new ScoreApiError(safeCode);
  }
  try {
    return await response.json();
  } catch {
    throw new ScoreApiError('INVALID_RESPONSE');
  }
}

let active: { started: Promise<string>; shots: Trace[]; goldenPickups: GoldenPickup[] } | null =
  null;

export function startCompetitiveRound(portrait: boolean, mode: GameMode = 'classic'): void {
  if (!sessionToken) {
    active = null;
    return;
  }
  active = {
    started: api('/api/round/start', { portrait, mode }).then((data) => String(data.roundId)),
    shots: [],
    goldenPickups: [],
  };
  // The result screen awaits this promise; silence abandoned scenes/rejections.
  void active.started.catch(() => undefined);
}

export function recordCompetitiveShot(shot: Trace): void {
  if (!active || active.shots.length >= 80) return;
  active.shots.push(shot);
}

/** Separate collectible interactions never increase the ordinary shot count. */
export function recordCompetitiveGoldenPickup(pickup: GoldenPickup): void {
  if (!active || active.goldenPickups.length >= 3) return;
  active.goldenPickups.push(pickup);
}

export async function submitCompetitiveRound(score: number): Promise<Submission> {
  const current = active;
  active = null;
  if (!sessionToken || !current) return { state: 'local' };
  try {
    const roundId = await current.started;
    const result = await api('/api/round/finish', {
      roundId,
      score,
      shots: current.shots,
      goldenPickups: current.goldenPickups,
    });
    return {
      state: 'saved',
      mode: result.mode,
      rankedScore: Number(result.rankedScore ?? result.score),
      referralBonus: Number(result.referralBonus || 0),
      telegramSynced: !!result.telegramSynced,
      telegramState: result.telegramState,
      telegramScores: result.telegramScores as Leader[],
      board: result.leaderboard as Board,
    };
  } catch (error) {
    // The server may be reachable but reject validation. Never disguise that
    // as a connectivity failure or claim the local score was registered.
    const reason = error instanceof ScoreApiError ? error.code : 'UNKNOWN_CLIENT_ERROR';
    return { state: 'unavailable', error: reason };
  }
}

/** Public standings, plus authenticated personal rank when launched from Telegram. */
export async function getLeaderboard(
  period: Period = 'week',
  offset = 0,
  mode: GameMode = getSelectedGameMode(),
): Promise<Board | undefined> {
  const query = new URLSearchParams({ period, offset: String(offset), mode });
  try {
    const headers = sessionToken ? { authorization: 'Bearer ' + sessionToken } : undefined;
    let response = await requestScoreApi('/api/leaderboard?' + query, {
      cache: 'no-store',
      headers,
    });
    // Expired sessions should still show public rankings.
    if (response.status === 401) {
      response = await requestScoreApi('/api/leaderboard?' + query, { cache: 'no-store' });
    }
    if (!response.ok) return undefined;
    return (await response.json()) as Board;
  } catch {
    return undefined;
  }
}

/** Retained for callers that only request the current Tehran competition. */
export function getWeeklyLeaderboard(): Promise<Board | undefined> {
  return getLeaderboard('week');
}

/** Verified progress only: untrusted browser localStorage cannot unlock competitive modes. */
export async function getPlayerProfile(): Promise<PlayerProfile | null> {
  if (!sessionToken) return null;
  try {
    const response = await requestScoreApi('/api/profile', {
      headers: { authorization: 'Bearer ' + sessionToken },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as PlayerProfile;
  } catch {
    return null;
  }
}
