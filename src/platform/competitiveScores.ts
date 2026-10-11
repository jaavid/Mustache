/**
 * Official Game backend bridge. Standalone browser visitors keep local scores.
 * Telegram identities come ONLY from server-issued callback session tokens.
 */
const API = 'https://mustache.zedai.ir';
type Aim = { x: number; y: number };
type Variant = 'normal' | 'sunglasses' | 'round' | 'headband' | 'gold';
type Trace = {
  tMs: number;
  aim: Aim;
  lip: Aim;
  variant: Variant;
  comboBefore: number;
};
export type Leader = { rank: number; name: string; score: number };
export type Period = 'day' | 'week' | 'month' | 'all';
export type Board = {
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
export type Submission = {
  state: 'local' | 'saved' | 'unavailable';
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

async function api(path: string, payload: unknown) {
  const response = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sessionToken },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Score service error ' + response.status);
  return response.json();
}

let active: { started: Promise<string>; shots: Trace[] } | null = null;

export function startCompetitiveRound(portrait: boolean): void {
  if (!sessionToken) {
    active = null;
    return;
  }
  active = {
    started: api('/api/round/start', { portrait }).then((data) => String(data.roundId)),
    shots: [],
  };
  // The result screen awaits this promise; silence abandoned scenes/rejections.
  void active.started.catch(() => undefined);
}

export function recordCompetitiveShot(shot: Trace): void {
  if (!active || active.shots.length >= 80) return;
  active.shots.push(shot);
}

export async function submitCompetitiveRound(score: number): Promise<Submission> {
  const current = active;
  active = null;
  if (!sessionToken || !current) return { state: 'local' };
  try {
    const roundId = await current.started;
    const result = await api('/api/round/finish', { roundId, score, shots: current.shots });
    return {
      state: 'saved',
      telegramSynced: !!result.telegramSynced,
      telegramState: result.telegramState,
      telegramScores: result.telegramScores as Leader[],
      board: result.leaderboard as Board,
    };
  } catch {
    // Never present local-only results as official scores.
    return { state: 'unavailable' };
  }
}

/** Public standings, plus authenticated personal rank when launched from Telegram. */
export async function getLeaderboard(period: Period = 'week', offset = 0): Promise<Board | undefined> {
  const query = new URLSearchParams({ period, offset: String(offset) });
  try {
    const headers = sessionToken ? { authorization: 'Bearer ' + sessionToken } : undefined;
    let response = await fetch(API + '/api/leaderboard?' + query, { cache: 'no-store', headers });
    // Expired sessions should still show public rankings.
    if (response.status === 401) {
      response = await fetch(API + '/api/leaderboard?' + query, { cache: 'no-store' });
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
