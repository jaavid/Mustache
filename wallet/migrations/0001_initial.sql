-- All amounts are stored in smallest token units as decimal TEXT (bigint-safe).
CREATE TABLE IF NOT EXISTS wallets (
  telegram_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL UNIQUE,
  key_cipher TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reward_batches (
  batch_id TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('genesis','weekly')),
  state TEXT NOT NULL DEFAULT 'PLANNED',
  total_raw TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS allocations (
  batch_id TEXT NOT NULL REFERENCES reward_batches(batch_id),
  telegram_user_id TEXT NOT NULL REFERENCES wallets(telegram_user_id),
  amount_raw TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  PRIMARY KEY(batch_id,telegram_user_id)
);
-- signed_raw persisted BEFORE attempting to broadcast; never generate a second
-- nonce/transfer for an existing operation_key after an ambiguous network error.
CREATE TABLE IF NOT EXISTS tx_jobs (
  operation_key TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  target TEXT NOT NULL,
  kind TEXT NOT NULL,
  value_raw TEXT NOT NULL,
  call_data TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  signed_raw TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'SIGNED' CHECK(state IN ('SIGNED','SUBMITTED','CONFIRMED','FAILED','REVIEW_REQUIRED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tx_jobs_sender_state ON tx_jobs(sender,state);
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL REFERENCES wallets(telegram_user_id),
  destination TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION' CHECK(state IN ('AWAITING_CONFIRMATION','READY','GAS_PENDING','TOKEN_PENDING','COMPLETE','REVIEW_REQUIRED','CANCELLED')),
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  CHECK (length(destination)=42)
);
CREATE INDEX IF NOT EXISTS withdrawal_user_state ON withdrawals(telegram_user_id,state);
-- Concurrent duplicate Telegram deliveries cannot create multiple active withdrawals.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_withdrawal_per_user ON withdrawals(telegram_user_id)
  WHERE state IN ('AWAITING_CONFIRMATION','READY','GAS_PENDING','TOKEN_PENDING');
CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  reference TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
