-- At-most-once automated Telegram announcement after an ON-CHAIN confirmed reward.
-- Claim is persisted BEFORE attempting send. Ambiguous Telegram responses are not
-- automatically replayed: operator reviews ATTEMPTED / FAILED in /admin.
CREATE TABLE IF NOT EXISTS reward_notifications (
  operation_key TEXT PRIMARY KEY REFERENCES allocations(operation_key),
  telegram_user_id TEXT NOT NULL REFERENCES wallets(telegram_user_id),
  state TEXT NOT NULL CHECK (state IN ('ATTEMPTED','SENT','FAILED')),
  attempted_at INTEGER NOT NULL,
  completed_at INTEGER,
  telegram_message_id INTEGER,
  failure_code TEXT
);
CREATE INDEX IF NOT EXISTS reward_notifications_state ON reward_notifications(state, attempted_at);
