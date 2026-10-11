CREATE TABLE IF NOT EXISTS game_users (
  user_id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES game_users(user_id),
  chat_id INTEGER,
  message_id INTEGER,
  inline_message_id TEXT,
  expires_at INTEGER NOT NULL,
  CHECK (inline_message_id IS NOT NULL OR (chat_id IS NOT NULL AND message_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_game_sessions_expiry ON game_sessions(expires_at);

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL REFERENCES game_sessions(token_hash),
  user_id INTEGER NOT NULL REFERENCES game_users(user_id),
  portrait INTEGER NOT NULL CHECK (portrait IN (0,1)),
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 15000)),
  week_start INTEGER,
  telegram_synced INTEGER NOT NULL DEFAULT 0,
  CHECK ((score IS NULL AND finished_at IS NULL AND week_start IS NULL) OR (score IS NOT NULL AND finished_at IS NOT NULL AND week_start IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_game_rounds_week ON game_rounds(week_start, user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_user ON game_rounds(user_id, finished_at DESC);
