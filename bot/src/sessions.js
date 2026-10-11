import { verifyRoundShots } from './scoring.js';
import { periodBounds, tehranWeekStart } from './periods.js';

const SESSION_TTL_MS = 60 * 60 * 1000;
const ROUND_TTL_MS = 3 * 60 * 1000;

export async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}

function publicName(from) {
  return String(from.first_name || 'Player').trim().replace(/[\r\n\u0000-\u001f]/g, '').slice(0, 48) || 'Player';
}

export async function issueSession(db, callback, gameUrl, now = Date.now()) {
  const from = callback.from;
  if (!from || !Number.isSafeInteger(from.id)) throw new Error('MISSING_TELEGRAM_USER');
  const message = callback.message;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;
  const inlineId = callback.inline_message_id;
  if (!inlineId && !(Number.isSafeInteger(chatId) && Number.isSafeInteger(messageId))) {
    throw new Error('MISSING_GAME_MESSAGE');
  }
  const token = newToken();
  const hash = await sha256(token);
  const name = publicName(from);
  await db.batch([
    db.prepare('INSERT INTO game_users (user_id, display_name, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at').bind(from.id, name, now),
    db.prepare('INSERT INTO game_sessions (token_hash, user_id, chat_id, message_id, inline_message_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(hash, from.id, inlineId ? null : chatId, inlineId ? null : messageId, inlineId || null, now + SESSION_TTL_MS),
  ]);
  const url = new URL(gameUrl);
  url.searchParams.set('tg_session', token);
  return url.toString();
}

export async function authenticate(db, request, now = Date.now()) {
  const value = request.headers.get('authorization') || '';
  const match = /^Bearer ([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  const hash = await sha256(match[1]);
  const session = await db.prepare('SELECT token_hash, user_id, chat_id, message_id, inline_message_id FROM game_sessions WHERE token_hash=? AND expires_at>?').bind(hash, now).first();
  return session || null;
}

export async function startRound(db, session, portrait, now = Date.now()) {
  if (typeof portrait !== 'boolean') throw new Error('INVALID_LAYOUT');
  const roundId = crypto.randomUUID();
  await db.prepare('INSERT INTO game_rounds (id, token_hash, user_id, portrait, started_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
    roundId, session.token_hash, session.user_id, portrait ? 1 : 0, now, now + ROUND_TTL_MS,
  ).run();
  return { roundId };
}

export async function finishRound(db, session, data, now = Date.now()) {
  if (!data || typeof data.roundId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.roundId)) throw new Error('INVALID_ROUND_ID');
  const round = await db.prepare('SELECT id, portrait, started_at, expires_at, score, week_start FROM game_rounds WHERE id=? AND token_hash=? AND user_id=?').bind(data.roundId, session.token_hash, session.user_id).first();
  if (!round) throw new Error('UNKNOWN_ROUND');
  if (round.score !== null) return { score: round.score, weekStart: round.week_start, duplicate: true };
  const duration = now - round.started_at;
  if (duration < 35000 || now > round.expires_at) throw new Error('INVALID_ROUND_DURATION');
  const { score, goldenPerfect } = verifyRoundShots(data.shots, !!round.portrait, data.score, data.goldenPickups ?? []);
  const weekStart = tehranWeekStart(now);
  const result = await db.prepare('UPDATE game_rounds SET score=?, week_start=?, finished_at=?, golden_perfect=? WHERE id=? AND token_hash=? AND score IS NULL AND expires_at>=?').bind(
    score, weekStart, now, goldenPerfect, round.id, session.token_hash, now,
  ).run();
  if (result.meta.changes !== 1) {
    const saved = await db.prepare('SELECT score, week_start FROM game_rounds WHERE id=?').bind(round.id).first();
    if (saved?.score !== null && saved?.score !== undefined) return { score: saved.score, weekStart: saved.week_start, duplicate: true };
    throw new Error('ROUND_ALREADY_PROCESSED');
  }
  return { score, weekStart, duplicate: false };
}

/** Rankings use finished_at rather than the legacy UTC-Monday week_start column.
 * Thus already-recorded production scores are correctly re-bucketed in Tehran.
 */
export async function leaderboard(db, now = Date.now(), options = {}) {
  const period = options.period || 'week';
  const offset = options.offset ?? 0;
  const bounds = periodBounds(now, period, offset);
  const viewer = Number.isSafeInteger(options.userId) && options.userId > 0 ? options.userId : 0;
  const range = bounds.start === null ? '' : ' AND finished_at >= ? AND finished_at < ?';
  const sql = [
    'WITH per_round AS (',
    ' SELECT user_id, score, golden_perfect, finished_at, id,',
    ' ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY score DESC, golden_perfect DESC, finished_at ASC, id ASC) AS own_rank',
    ' FROM game_rounds WHERE score IS NOT NULL' + range,
    '), highs AS (',
    ' SELECT user_id, score, golden_perfect FROM per_round WHERE own_rank=1',
    '), ranked AS (',
    ' SELECT h.user_id, u.display_name, h.score, h.golden_perfect,',
    ' ROW_NUMBER() OVER (ORDER BY h.score DESC, h.golden_perfect DESC, h.user_id ASC) AS rank,',
    ' COUNT(*) OVER () AS player_count',
    ' FROM highs h JOIN game_users u ON u.user_id=h.user_id',
    ')',
    'SELECT user_id, display_name, score, golden_perfect, rank, player_count FROM ranked',
    'WHERE rank <= 10 OR user_id = ? ORDER BY rank',
  ].join(' ');
  const bindings = bounds.start === null ? [viewer] : [bounds.start, bounds.end, viewer];
  const list = await db.prepare(sql).bind(...bindings).all();
  const rows = list.results || [];
  const mapEntry = row => ({
    rank: Number(row.rank), name: row.display_name, score: Number(row.score),
    goldenPerfect: Number(row.golden_perfect || 0),
  });
  const result = {
    ...bounds, playerCount: rows.length ? Number(rows[0].player_count) : 0,
    players: rows.filter(row => Number(row.rank) <= 10).map(mapEntry),
  };
  if (viewer) {
    const self = rows.find(row => Number(row.user_id) === viewer);
    result.me = self ? mapEntry(self) : null;
  }
  return result;
}
