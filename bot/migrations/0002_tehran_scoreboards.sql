-- Keep existing rows intact: historic and new contest windows use finished_at.
CREATE INDEX IF NOT EXISTS idx_game_rounds_finished_user_score
ON game_rounds(finished_at, user_id, score);
ALTER TABLE game_rounds ADD COLUMN telegram_state TEXT NOT NULL DEFAULT 'pending';
