-- Inspectable, aggregate-friendly measurements from server-verified impact traces.
-- No Telegram identity, individual aim point or timestamp is copied into this table.
CREATE TABLE IF NOT EXISTS game_round_metrics (
  round_id TEXT PRIMARY KEY REFERENCES game_rounds(id),
  shots INTEGER NOT NULL CHECK (shots BETWEEN 0 AND 80),
  perfect INTEGER NOT NULL CHECK (perfect BETWEEN 0 AND 80),
  good INTEGER NOT NULL CHECK (good BETWEEN 0 AND 80),
  misses INTEGER NOT NULL CHECK (misses BETWEEN 0 AND 80),
  max_combo INTEGER NOT NULL CHECK (max_combo BETWEEN 0 AND 80),
  golden_pickups INTEGER NOT NULL CHECK (golden_pickups BETWEEN 0 AND 3),
  CHECK (shots = perfect + good + misses)
);
