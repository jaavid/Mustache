# N5 Polygon Amoy — 100 tNFIVE welcome gift and weekly prizes

Scope: testnet only. Wallet signing and automatic rewards remain OFF by default.
The PR adds planning, audits and private notifications after confirmed transfers,
but does not execute any blockchain transaction.

## Distribution rules

Welcome: 100 tNFIVE per existing wallet, fixed id: welcome-100-202610.
At 20 wallets that is exactly 2,000 tNFIVE and 20 separate ERC20 transfers.
Re-planning the same batch is idempotent; a different existing genesis batch
blocks the new campaign until safely reconciled.

Weekly: a SEPARATE weekly-TIMESTAMP batch, based on the last fully completed
Saturday-to-Saturday Tehran week. Only confirmed server-side gameplay scores
count. The existing rule is 40% of the weekly pool equally shared among eligible
players and 60% weighted by their rank.

IMPORTANT: WEEKLY_POOL_TOKENS is currently configured as 10,000. This default
is NOT explicit authorization to disburse that much this week. Obtain owner
confirmation of the first weekly budget before preparing or approving it.
If confirmed at 10,000, the operational distributor needs 12,000 tNFIVE
plus enough Amoy test POL for 20 welcome transactions and one per weekly winner.

## Preview and planning (requires private ADMIN_API_TOKEN, never share it)

GET /admin/preflight: confirm Amoy chain 80002, token contract and balances,
including both tNFIVE and POL in the Distributor. NOT_CONFIGURED means no
signing is possible.

GET /admin/welcome/preview: inspect the saved wallet snapshot and exact amounts.
POST /admin/welcome/prepare: write the PLANNED gift batch (never signs).
The legacy POST /admin/genesis/prepare is routed to the same 100-token batch
rather than the old rank-weighted 10,000-token genesis pool.

GET /admin/weekly/preview: inspect weekly rank list and budget without writes.
POST /admin/weekly/plan: stage a separate weekly batch ONLY after the pool is
confirmed. Leave AUTO_REWARDS_ENABLED false.

Review the /admin Distribution, Batch detail, Weekly preview, and Treasury
tabs. Check counts, amounts, previous batches, and operator balance before
authorizing even a small test transfer.

After a successful ONE-recipient test, independently approve each prepared
batch with POST /admin/batches/BATCH_ID/approve. This requires sufficient
Distributor tNFIVE. Approval still does NOT sign.

TRANSFERS_ENABLED remains false in wallet/wrangler.jsonc and the GitHub
deploy workflow enforces it. Enabling test transfers must be reviewed as a
separate, explicit go-live change after confirming sufficient test POL,
idempotency, and token receipts. Do not bypass the deploy workflow guard.

## Chain verification and private Telegram announcements

The engine stores each signed transaction before sending it, retains
operation keys and reuses the same signed raw bytes after uncertain RPC
responses. An ERC20 gift counts as CONFIRMED only after its receipt has
the required block confirmations AND its contract Transfer event matches
sender, recipient, and raw token amount. Missing/mismatched events are
REVIEW_REQUIRED; users are never told these were credited.

The bot will poll every five minutes for already-confirmed reward events.
Wallet D1 atomically records the first notification attempt before Telegram
is called. The private message includes the credited test NFIVE amount,
welcome or weekly title, Amoy Polygonscan transaction hash, and the deep link
https://t.me/RJTtobot?start=wallet. It is not sent for pending transactions.

For at-most-once messages, a failed or unknown delivery remains FAILED or
ATTEMPTED and is NOT blindly retried. /admin shows message status per batch
and per recipient for manual review. Nothing in the notification path
calls the wallet transfer or approval API.

## Rollout

1. Merge the PR only after Wallet and Telegram tests pass.
2. Bot deployment runs automatically. Its scheduled sender is non-signing.
3. Manually deploy Wallet Worker on main through the existing Wallet Action.
   It first applies migration 0002_reward_notifications.sql, then deploys
   with transfers and automatic rewards still disabled.
4. Confirm /admin displays the 20 saved wallets and the new tabs; no funds
   or wallet addresses have been modified by these migrations.
5. Confirm the first weekly pool budget. Check Distributor funding and POL,
   then authorize and verify one small test transfer before full rollout.

Never rotate WALLET_ENCRYPTION_KEY, share DISTRIBUTOR_PRIVATE_KEY, or
put private keys in GitHub, logs, comments or chat.
