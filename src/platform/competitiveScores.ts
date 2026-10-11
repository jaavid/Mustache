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
type Leader = { rank: number; name: string; score: number };
export type Board = { weekStart: string; weekEnds: string; players: Leader[] };
export type Submission = {
  state: 'local' | 'saved' | 'unavailable';
  telegramSynced?: boolean;
  board?: Board;
};

const sessionToken = (() => {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('tg_session');
  if (!value || !/^[0-9a-f]{64}$/.test(value)) return null;
  params.delete('tg_session');
  const query = params.toString();
  // Remove the bearer token from browser history and future Referer headers.
  window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
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
  if (!sessionToken) { active = null; return; }
  active = {
    started: api('/api/round/start', { portrait }).then(data => String(data.roundId)),
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
    return { state: 'saved', telegramSynced: !!result.telegramSynced, board: result.leaderboard as Board };
  } catch {
    // Never present local-only results as official scores.
    return { state: 'unavailable' };
  }
}

/** Public weekly board for browser visitors and for retries after submission. */
export async function getWeeklyLeaderboard(): Promise<Board | undefined> {
  try {
    const response = await fetch(API + '/api/leaderboard', { cache: 'no-store' });
    if (!response.ok) return undefined;
    return (await response.json()) as Board;
  } catch {
    return undefined;
  }
}
