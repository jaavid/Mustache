import { periodBounds } from './periods.js';

export const GOLD_UNLOCK_ROUNDS = 12;
export const GOLD_UNLOCK_DAYS = 2;
export const DAILY_REFERRAL_CAP = 3;
export const REFERRAL_BONUS_PERCENT = 5;
export const REFERRAL_MAX_POINTS = 200;

export function referralIdFromStart(message) {
  const match = /^\/start(?:@[a-zA-Z0-9_]+)?\s+ref_([0-9a-z]{1,12})$/i.exec(String(message || '').trim());
  if (!match) return null;
  const value = parseInt(match[1], 36);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** A referral is accepted once per new Telegram identity, before first verified round.
 * No reward is granted until that identity completes a validated 45s round.
 */
export async function registerReferral(db, from, message, now = Date.now()) {
  const referrerId = referralIdFromStart(message);
  if (!referrerId || !Number.isSafeInteger(from?.id) || from.id <= 0 || from.id === referrerId) return false;
  const name = String(from.first_name || 'Player').trim().slice(0, 48) || 'Player';
  await db.prepare(
    'INSERT INTO game_users(user_id, display_name, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at'
  ).bind(from.id, name, now).run();
  const result = await db.prepare(
    'INSERT OR IGNORE INTO game_referrals (referred_user_id, referrer_user_id, created_at) ' +
    'SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM game_users WHERE user_id=?) ' +
    'AND NOT EXISTS (SELECT 1 FROM game_rounds WHERE user_id=? AND score IS NOT NULL)'
  ).bind(from.id, referrerId, now, referrerId, from.id).run();
  return result.meta.changes === 1;
}

export function referralBonus(score, invited) {
  if (!Number.isSafeInteger(score) || score < 0) return 0;
  const count = Math.min(DAILY_REFERRAL_CAP, Math.max(0, Math.floor(invited)));
  return Math.min(REFERRAL_MAX_POINTS, Math.floor(score * count * REFERRAL_BONUS_PERCENT / 100));
}

export async function dailyReferralCount(db, userId, now = Date.now()) {
  const { start, end } = periodBounds(now, 'day');
  const row = await db.prepare(
    'SELECT COUNT(*) AS total FROM (SELECT referred_user_id FROM game_referrals ' +
    'WHERE referrer_user_id=? AND qualified_at>=? AND qualified_at<? ' +
    'ORDER BY qualified_at, referred_user_id LIMIT ?)'
  ).bind(userId, start, end, DAILY_REFERRAL_CAP).first();
  return Math.min(DAILY_REFERRAL_CAP, Number(row?.total || 0));
}

export async function getProgress(db, userId, now = Date.now()) {
  const row = await db.prepare(
    'SELECT xp, rounds_played, active_days, last_active_day FROM game_progress WHERE user_id=?'
  ).bind(userId).first();
  const roundsPlayed = Number(row?.rounds_played || 0);
  const activeDays = Number(row?.active_days || 0);
  const xp = Number(row?.xp || 0);
  const { start } = periodBounds(now, 'day');
  const ticket = await db.prepare(
    'SELECT 1 AS used FROM game_gold_tickets WHERE user_id=? AND tehran_day=?'
  ).bind(userId, start).first();
  return { xp, level: 1 + Math.floor(xp / 500), nextLevelXp: (Math.floor(xp / 500) + 1) * 500,
    roundsPlayed, activeDays, goldUnlocked: roundsPlayed >= GOLD_UNLOCK_ROUNDS && activeDays >= GOLD_UNLOCK_DAYS,
    ticketUsedToday: !!ticket, dailyInvites: await dailyReferralCount(db, userId, now) };
}

export function goldCatchUpEligible(progress, board) {
  return !progress.goldUnlocked && !progress.ticketUsedToday &&
    progress.roundsPlayed >= 5 && board.playerCount >= 20 &&
    !!board.me && board.me.rank > board.playerCount * 0.7;
}

/** Evaluate the weekly catch-up entitlement using server-side ranking. */
export async function permitGoldRound(db, userId, board, now = Date.now()) {
  const progress = await getProgress(db, userId, now);
  if (progress.goldUnlocked) return;
  if (!goldCatchUpEligible(progress, board)) throw new Error('GOLD_RUSH_LOCKED');
  const result = await db.prepare(
    'INSERT OR IGNORE INTO game_gold_tickets (user_id, tehran_day) VALUES (?, ?)'
  ).bind(userId, periodBounds(now, 'day').start).run();
  if (result.meta.changes !== 1) throw new Error('GOLD_TICKET_USED');
}

/** Idempotent after a completed round, including retries of a saved round.
 * D1 batch executes the insert and marker update in one transaction.
 */
export async function recordCompletedRound(db, roundId, userId, score, now = Date.now()) {
  const { start } = periodBounds(now, 'day');
  const xp = 40 + Math.min(20, Math.floor(score / 100));
  await db.batch([
    db.prepare(
      'INSERT INTO game_progress (user_id, xp, rounds_played, active_days, last_active_day, updated_at) ' +
      'SELECT user_id, ?, 1, 1, ?, ? FROM game_rounds ' +
      'WHERE id=? AND user_id=? AND score IS NOT NULL AND progress_recorded=0 ' +
      'ON CONFLICT(user_id) DO UPDATE SET xp=game_progress.xp+excluded.xp, ' +
      'rounds_played=game_progress.rounds_played+1, ' +
      'active_days=game_progress.active_days+CASE WHEN game_progress.last_active_day=excluded.last_active_day THEN 0 ELSE 1 END, ' +
      'last_active_day=excluded.last_active_day, updated_at=excluded.updated_at'
    ).bind(xp, start, now, roundId, userId),
    db.prepare('UPDATE game_rounds SET progress_recorded=1 WHERE id=? AND user_id=? AND progress_recorded=0')
      .bind(roundId, userId),
  ]);
  await db.prepare(
    'UPDATE game_referrals SET qualified_at=? WHERE referred_user_id=? AND qualified_at IS NULL'
  ).bind(now, userId).run();
}

export async function dailyMissions(db, userId, now = Date.now()) {
  const { start, end } = periodBounds(now, 'day');
  const row = await db.prepare(
    "SELECT COUNT(*) AS rounds, MAX(score) AS best, SUM(golden_perfect) AS golden " +
    "FROM game_rounds WHERE user_id=? AND mode='classic' AND score IS NOT NULL AND finished_at>=? AND finished_at<?"
  ).bind(userId, start, end).first();
  const rounds = Number(row?.rounds || 0);
  const best = Number(row?.best || 0);
  const golden = Number(row?.golden || 0);
  return [
    { id: 'rounds', title: 'PLAY 2 CLASSIC ROUNDS', current: Math.min(2, rounds), target: 2, done: rounds >= 2 },
    { id: 'score', title: 'SCORE 1200 IN A ROUND', current: Math.min(1200, best), target: 1200, done: best >= 1200 },
    { id: 'golden', title: 'LAND GOLDEN PERFECT', current: Math.min(1, golden), target: 1, done: golden >= 1 },
  ];
}

export async function playerProfile(db, userId, botUsername = 'RJTtobot', now = Date.now()) {
  const progress = await getProgress(db, userId, now);
  const [user, stats, missions] = await Promise.all([
    db.prepare('SELECT display_name FROM game_users WHERE user_id=?').bind(userId).first(),
    db.prepare(
      'SELECT COUNT(*) AS rounds, MAX(score) AS best, SUM(golden_perfect) AS golden_perfects ' +
      'FROM game_rounds WHERE user_id=? AND score IS NOT NULL'
    ).bind(userId).first(),
    dailyMissions(db, userId, now),
  ]);
  return { ...progress, missions, name: user?.display_name || 'Player', bestScore: Number(stats?.best || 0),
    goldenPerfects: Number(stats?.golden_perfects || 0),
    inviteUrl: 'https://t.me/' + botUsername + '?start=ref_' + userId.toString(36) };
}
