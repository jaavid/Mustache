import { verifyRoundShots } from './scoring.js';
import { periodBounds, tehranWeekStart } from './periods.js';
import { dailyReferralCount, referralBonus, permitGoldRound, completedRoundStatements, recordCompletedRound } from './progression.js';

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

/** Create a round and, for catch-up entry, consume the daily ticket atomically. */
export async function startRound(db, session, portrait, now = Date.now(), mode = 'classic') {
  if (typeof portrait !== 'boolean') throw new Error('INVALID_LAYOUT');
  if (!['classic', 'goldRush'].includes(mode)) throw new Error('INVALID_MODE');
  const ticket = mode === 'goldRush'
    ? await permitGoldRound(db, session.user_id, await leaderboard(db, now, { userId: session.user_id }), now)
    : null;
  const roundId = crypto.randomUUID();
  const insert = db.prepare(
    'INSERT INTO game_rounds (id, token_hash, user_id, portrait, started_at, expires_at, mode) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(roundId, session.token_hash, session.user_id, portrait ? 1 : 0, now, now + ROUND_TTL_MS, mode);
  try {
    if (ticket) await db.batch([ticket, insert]);
    else await insert.run();
  } catch (error) {
    // Only a ticket unique-constraint error becomes GOLD_TICKET_USED;
    // a failed round insert must surface as a real DB error, after rollback.
    if (ticket && /(?:UNIQUE constraint failed|PRIMARY KEY constraint failed): game_gold_tickets\./i.test(String(error?.message))) {
      throw new Error('GOLD_TICKET_USED');
    }
    throw error;
  }
  return { roundId, mode };
}

export async function finishRound(db, session, data, now = Date.now()) {
  if (!data || typeof data.roundId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.roundId)) throw new Error('INVALID_ROUND_ID');
  const round = await db.prepare('SELECT id, portrait, started_at, expires_at, score, week_start, mode, ranked_score FROM game_rounds WHERE id=? AND token_hash=? AND user_id=?').bind(data.roundId, session.token_hash, session.user_id).first();
  if (!round) throw new Error('UNKNOWN_ROUND');
  if (round.score !== null) {
    await recordCompletedRound(db, round.id, session.user_id, round.score, now);
    return { score: round.score, rankedScore: round.ranked_score ?? round.score, weekStart: round.week_start, mode: round.mode || 'classic', duplicate: true };
  }
  const duration = now - round.started_at;
  if (duration < 35000 || now > round.expires_at) throw new Error('INVALID_ROUND_DURATION');
  const verified = verifyRoundShots(data.shots, !!round.portrait, data.score, data.goldenPickups ?? [], round.mode || 'classic');
  const { score, goldenPerfect } = verified;
  const weekStart = tehranWeekStart(now);
  const activeInvites = (round.mode || 'classic') === 'classic' ? await dailyReferralCount(db, session.user_id, now) : 0;
  const bonus = Math.min(referralBonus(score, activeInvites), 15000 - score);
  const rankedScore = score + bonus;
  // D1 batch runs all statements in a single transaction: a failure at XP,
  // idempotency marking or referral qualification rolls back the score too.
  const [result] = await db.batch([
    db.prepare(
      'UPDATE game_rounds SET score=?, week_start=?, finished_at=?, golden_perfect=?, ranked_score=? ' +
      'WHERE id=? AND token_hash=? AND score IS NULL AND expires_at>=?'
    ).bind(score, weekStart, now, goldenPerfect, rankedScore, round.id, session.token_hash, now),
    ...completedRoundStatements(db, round.id, session.user_id, score, now, true),
    // Only accepted, progress-recorded rounds generate analytics. Ignore duplicate retries.
    db.prepare('INSERT OR IGNORE INTO game_round_metrics ' +
      '(round_id, shots, perfect, good, misses, max_combo, golden_pickups) ' +
      'SELECT id, ?, ?, ?, ?, ?, ? FROM game_rounds ' +
      'WHERE id=? AND score IS NOT NULL AND progress_recorded=1'
    ).bind(verified.count, verified.perfect, verified.good, verified.misses,
      verified.maxCombo, (data.goldenPickups ?? []).length, round.id),
  ]);
  if (result.meta.changes !== 1) {
    const saved = await db.prepare('SELECT score, week_start, mode, ranked_score FROM game_rounds WHERE id=?').bind(round.id).first();
    if (saved?.score !== null && saved?.score !== undefined) return { score: saved.score, rankedScore: saved.ranked_score ?? saved.score, weekStart: saved.week_start, mode: saved.mode || 'classic', duplicate: true };
    throw new Error('ROUND_ALREADY_PROCESSED');
  }
  return { score, rankedScore, referralBonus: bonus, weekStart, mode: round.mode || 'classic', duplicate: false };
}

/** Rankings use finished_at rather than the legacy UTC-Monday week_start column.
 * Thus already-recorded production scores are correctly re-bucketed in Tehran.
 */
export async function leaderboard(db, now = Date.now(), options = {}) {
  const period = options.period || 'week';
  const mode = options.mode || 'classic';
  if (!['classic', 'goldRush'].includes(mode)) throw new Error('INVALID_MODE');
  const offset = options.offset ?? 0;
  const bounds = periodBounds(now, period, offset);
  const viewer = Number.isSafeInteger(options.userId) && options.userId > 0 ? options.userId : 0;
  const range = bounds.start === null ? '' : ' AND finished_at >= ? AND finished_at < ?';
  // Temporary referral power-ups affect only day/week boards. Month/all-time
  // preserve raw historical records and cannot be inflated with invites.
  const rankedPoints = period === 'day' || period === 'week'
    ? 'COALESCE(ranked_score, score)' : 'score';
  const boostPoints = period === 'day' || period === 'week'
    ? 'COALESCE(ranked_score, score)-score' : '0';
  const sql = [
    'WITH per_round AS (',
    ' SELECT user_id, ' + rankedPoints + ' AS score, score AS base_score,',
    ' ' + boostPoints + ' AS boost_points, golden_perfect, finished_at, id,',
    ' ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ' + rankedPoints + ' DESC, golden_perfect DESC, finished_at ASC, id ASC) AS own_rank',
    " FROM game_rounds WHERE score IS NOT NULL AND mode='" + mode + "'" + range,
    '), highs AS (',
    ' SELECT user_id, score, base_score, boost_points, golden_perfect FROM per_round WHERE own_rank=1',
    '), ranked AS (',
    ' SELECT h.user_id, u.display_name, h.score, h.base_score, h.boost_points, h.golden_perfect,',
    ' ROW_NUMBER() OVER (ORDER BY h.score DESC, h.golden_perfect DESC, h.user_id ASC) AS rank,',
    ' COUNT(*) OVER () AS player_count',
    ' FROM highs h JOIN game_users u ON u.user_id=h.user_id',
    ')',
    'SELECT user_id, display_name, score, base_score, boost_points, golden_perfect, rank, player_count FROM ranked',
    'WHERE rank <= 10 OR user_id = ? OR rank = (SELECT rank - 1 FROM ranked WHERE user_id = ?) ORDER BY rank',
  ].join(' ');
  const bindings = bounds.start === null ? [viewer, viewer] : [bounds.start, bounds.end, viewer, viewer];
  const list = await db.prepare(sql).bind(...bindings).all();
  const rows = list.results || [];
  const mapEntry = row => ({
    rank: Number(row.rank), name: row.display_name, score: Number(row.score),
    goldenPerfect: Number(row.golden_perfect || 0),
    baseScore: Number(row.base_score ?? row.score), boostPoints: Number(row.boost_points || 0),
  });
  const result = {
    ...bounds, mode, playerCount: rows.length ? Number(rows[0].player_count) : 0,
    players: rows.filter(row => Number(row.rank) <= 10).map(mapEntry),
  };
  if (viewer) {
    const self = rows.find(row => Number(row.user_id) === viewer);
    result.me = self ? mapEntry(self) : null;
    const next = rows.find(row => Number(row.rank) === Number(self?.rank) - 1);
    result.rival = next ? mapEntry(next) : null;
  }
  return result;
}
