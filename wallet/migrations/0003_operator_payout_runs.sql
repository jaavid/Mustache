-- Operator-initiated rewards: a prepared/approved Batch is never sufficient to start payouts.
-- A separate admin-only, one-time challenge grants execution per Batch.
CREATE TABLE IF NOT EXISTS operator_payout_runs (
  batch_id TEXT PRIMARY KEY REFERENCES reward_batches(batch_id),
  phase TEXT NOT NULL CHECK(phase IN ('PILOT','PILOT_OK','ALL','PAUSED','COMPLETE')),
  pilot_user_id TEXT NOT NULL REFERENCES wallets(telegram_user_id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS operator_payout_tickets (
  ticket TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES reward_batches(batch_id),
  operation TEXT NOT NULL CHECK(operation IN ('PILOT','ALL')),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payout_tickets_expires ON operator_payout_tickets(expires_at);

-- Durable, at-most-once operator milestone messages (pilot confirmed,
-- batch finished, or paused for review). Message delivery is independent
-- from both chain signing and player notifications.
CREATE TABLE IF NOT EXISTS operator_payout_notices (
  batch_id TEXT NOT NULL REFERENCES reward_batches(batch_id),
  phase TEXT NOT NULL CHECK(phase IN ('PILOT_OK','PAUSED','COMPLETE')),
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','ATTEMPTED','SENT','FAILED')),
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  delivered_at INTEGER,
  PRIMARY KEY(batch_id,phase)
);
