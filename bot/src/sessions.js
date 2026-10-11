import { mondayUtc, verifyRoundShots } from './scoring.js';

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
  const { score } = verifyRoundShots(data.shots, !!round.portrait, data.score);
  const weekStart = mondayUtc(now);
  const result = await db.prepare('UPDATE game_rounds SET score=?, week_start=?, finished_at=? WHERE id=? AND token_hash=? AND score IS NULL AND expires_at>=?').bind(
    score, weekStart, now, round.id, session.token_hash, now,
  ).run();
  if (result.meta.changes !== 1) {
    const saved = await db.prepare('SELECT score, week_start FROM game_rounds WHERE id=?').bind(round.id).first();
    if (saved?.score !== null && saved?.score !== undefined) return { score: saved.score, weekStart: saved.week_start, duplicate: true };
    throw new Error('ROUND_ALREADY_PROCESSED');
  }
  return { score, weekStart, duplicate: false };
}

export async function leaderboard(db, now = Date.now()) {
  const weekStart = mondayUtc(now);
  const list = await db.prepare(`
    SELECT g.user_id, u.display_name, MAX(g.score) AS score
    FROM game_rounds g JOIN game_users u ON u.user_id=g.user_id
    WHERE g.week_start=? AND g.score IS NOT NULL
    GROUP BY g.user_id, u.display_name
    ORDER BY score DESC, g.user_id ASC LIMIT 10
  `).bind(weekStart).all();
  return { weekStart: new Date(weekStart).toISOString().slice(0,10), weekEnds: new Date(weekStart + 604800000).toISOString().slice(0,10), players: (list.results || []).map((row,i) => ({ rank: i+1, name: row.display_name, score: row.score })) };
}
