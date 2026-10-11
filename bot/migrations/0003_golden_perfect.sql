-- Backwards compatible: historical rounds have no golden achievement.
ALTER TABLE game_rounds ADD COLUMN golden_perfect INTEGER NOT NULL DEFAULT 0 CHECK (golden_perfect IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_game_rounds_golden_tiebreak ON game_rounds(user_id, score DESC, golden_perfect DESC);
