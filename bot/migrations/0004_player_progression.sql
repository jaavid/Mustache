-- Persist progression separately from the existing historical score records.
CREATE TABLE IF NOT EXISTS game_progress (
  user_id INTEGER PRIMARY KEY REFERENCES game_users(user_id),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  rounds_played INTEGER NOT NULL DEFAULT 0 CHECK (rounds_played >= 0),
  active_days INTEGER NOT NULL DEFAULT 0 CHECK (active_days >= 0),
  last_active_day INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS game_referrals (
  referred_user_id INTEGER PRIMARY KEY REFERENCES game_users(user_id),
  referrer_user_id INTEGER NOT NULL REFERENCES game_users(user_id),
  created_at INTEGER NOT NULL,
  qualified_at INTEGER,
  CHECK (referred_user_id <> referrer_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_qualified
  ON game_referrals(referrer_user_id, qualified_at, referred_user_id);
CREATE TABLE IF NOT EXISTS game_gold_tickets (
  user_id INTEGER NOT NULL REFERENCES game_users(user_id),
  tehran_day INTEGER NOT NULL,
  PRIMARY KEY (user_id, tehran_day)
);
ALTER TABLE game_rounds ADD COLUMN mode TEXT NOT NULL DEFAULT 'classic'
  CHECK (mode IN ('classic', 'goldRush'));
ALTER TABLE game_rounds ADD COLUMN ranked_score INTEGER
  CHECK (ranked_score IS NULL OR (ranked_score >= 0 AND ranked_score <= 15000));
ALTER TABLE game_rounds ADD COLUMN progress_recorded INTEGER NOT NULL DEFAULT 0
  CHECK (progress_recorded IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_rounds_mode_finished ON game_rounds(mode, finished_at, user_id);
