/** Mustache2 casual (non-prize) leaderboard. Scores are browser-submitted and not authoritative replay.
 * Never use these scores for rewards, wallet credit, or Mustache1 competitive rankings.
 */
const MAX_SCORE = 6420;
export function validateMustache2Result(round, data, now = Date.now()) {
  if (!round || round.score !== null) throw new Error('INVALID_ROUND');
  if (!data || typeof data !== 'object') throw new Error('INVALID_RESULT');
  const { score, caught, shots, elapsedSeconds } = data;
  if (![score, caught, shots, elapsedSeconds].every(Number.isInteger)) throw new Error('INVALID_RESULT');
  if (score < 0 || score > MAX_SCORE || caught < 0 || caught > 3 ||
      shots < caught || shots > 10000 || elapsedSeconds < 0 || elapsedSeconds > 180) {
    throw new Error('INVALID_RESULT');
  }
  if (now < round.started_at + 1000 || now > round.expires_at ||
      elapsedSeconds > (now - round.started_at) / 1000 + 5) {
    throw new Error('INVALID_DURATION');
  }
  // Score rules: each catch earns 1000 + remainingSeconds*3;
  // victory adds remainingSeconds*10. These bounds do NOT prove honest play.
  const maximum = caught * 1540 + (caught === 3 ? 1800 : 0);
  if (score < caught * 1000 || score > maximum || (caught === 0 && score !== 0) ||
      (caught < 3 && elapsedSeconds !== 180)) {
    throw new Error('INVALID_SCORE');
  }
  return { score, caught, shots, elapsedSeconds };
}

export async function startMustache2Round(db, session, now = Date.now()) {
  const roundId = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO mustache2_rounds (id, token_hash, user_id, started_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(roundId, session.token_hash, session.user_id, now, now + 30 * 60 * 1000).run();
  return { roundId, expiresAt: now + 30 * 60 * 1000 };
}

export async function finishMustache2Round(db, session, data, now = Date.now()) {
  if (typeof data?.roundId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.roundId)) {
    throw new Error('INVALID_ROUND_ID');
  }
  const row = await db.prepare(
    'SELECT id, started_at, expires_at, score, telegram_state FROM mustache2_rounds WHERE id=? AND user_id=? AND token_hash=?'
  ).bind(data.roundId, session.user_id, session.token_hash).first();
  if (!row) throw new Error('INVALID_ROUND');
  if (row.score !== null) return { score: row.score, duplicate: true, telegramState: row.telegram_state };
  const result = validateMustache2Result(row, data, now);
  const write = await db.prepare(
    'UPDATE mustache2_rounds SET score=?, caught=?, shots=?, elapsed_seconds=?, finished_at=? ' +
    'WHERE id=? AND user_id=? AND token_hash=? AND score IS NULL'
  ).bind(result.score, result.caught, result.shots, result.elapsedSeconds, now,
    data.roundId, session.user_id, session.token_hash).run();
  if (write.meta?.changes !== 1) {
    // A concurrent submission may already have committed the same round.
    // Return its persisted result instead of turning an idempotent retry into HTTP 400.
    const saved = await db.prepare(
      'SELECT score, telegram_state FROM mustache2_rounds WHERE id=? AND user_id=? AND token_hash=?'
    ).bind(data.roundId, session.user_id, session.token_hash).first();
    if (saved && saved.score !== null) {
      return { score: saved.score, duplicate: true, telegramState: saved.telegram_state };
    }
    throw new Error('ROUND_ALREADY_PROCESSED');
  }
  return { score: result.score, duplicate: false, telegramState: 'pending' };
}

export async function mustache2Leaderboard(db, userId = null) {
  const query = 'FROM mustache2_rounds r JOIN game_users u ON u.user_id=r.user_id ' +
    'WHERE r.score IS NOT NULL';
  const top = await db.prepare(
    'SELECT u.user_id AS userId, u.display_name AS name, MAX(r.score) AS score ' +
    query + ' GROUP BY u.user_id ORDER BY score DESC, u.user_id ASC LIMIT 10'
  ).all();
  const count = await db.prepare(
    'SELECT COUNT(DISTINCT user_id) AS players FROM mustache2_rounds WHERE score IS NOT NULL'
  ).first();
  let me = null;
  if (Number.isSafeInteger(userId)) {
    const mine = await db.prepare(
      'SELECT MAX(score) AS score FROM mustache2_rounds WHERE user_id=? AND score IS NOT NULL'
    ).bind(userId).first();
    if (mine?.score !== null && mine?.score !== undefined) {
      const above = await db.prepare(
        'SELECT COUNT(*) AS rank FROM (' +
          'SELECT user_id, MAX(score) AS best FROM mustache2_rounds WHERE score IS NOT NULL GROUP BY user_id' +
        ') WHERE best > ? OR (best = ? AND user_id < ?)'
      ).bind(mine.score, mine.score, userId).first();
      me = { rank: Number(above?.rank || 0) + 1, score: mine.score };
    }
  }
  return {
    period: 'all', competitive: false, players: Number(count?.players || 0),
    top: (top.results || []).map((row, i) => ({
      rank: i + 1, name: row.name, score: Number(row.score),
    })),
    me,
  };
}
