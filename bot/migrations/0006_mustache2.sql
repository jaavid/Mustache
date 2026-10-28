-- Keep Telegram identities shared, but isolate every game's score records.
ALTER TABLE game_sessions ADD COLUMN game_short_name TEXT NOT NULL DEFAULT 'mustache';
CREATE TABLE mustache2_rounds (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL REFERENCES game_sessions(token_hash),
  user_id INTEGER NOT NULL REFERENCES game_users(user_id),
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER CHECK (score IS NULL OR (score BETWEEN 0 AND 6420)),
  caught INTEGER CHECK (caught IS NULL OR (caught BETWEEN 0 AND 3)),
  shots INTEGER CHECK (shots IS NULL OR shots >= 0),
  elapsed_seconds INTEGER,
  telegram_state TEXT NOT NULL DEFAULT 'pending',
  CHECK ((score IS NULL AND finished_at IS NULL) OR (score IS NOT NULL AND finished_at IS NOT NULL))
);
CREATE INDEX idx_mustache2_user_score ON mustache2_rounds(user_id, score DESC);
CREATE INDEX idx_mustache2_finished ON mustache2_rounds(finished_at);
