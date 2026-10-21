# N5 /admin guided distribution (Polygon Amoy TESTNET ONLY)

## Why this change exists

The current on-chain operator wallet has 30,000 tNFIVE and 0.2 test POL
according to the owner's latest private /admin check, against a funded
campaign budget of 12,000 tNFIVE (2,000 for the original 20 players plus
10,000 for the last fully completed Tehran competition week).

The pre-existing, **unbroadcast** genesis-0 draft was incorrectly planned
for 10,000 tNFIVE. It MUST NOT be approved or broadcast as-is.

## Controls in /admin

Choose **مدیریت پرداخت‌های تستی**, then:

1. Select **هدیه ۱۰۰تایی**. The screen checks the configured Amoy RPC,
   Distributor address, token and POL balances, all existing batches,
   and the 20-player cohort.
2. Press **آماده‌سازی بدون ارسال**. If genesis-0 still has exactly 20
   unchanged original allocations and **zero** signed transactions, it is
   re-planned **in place** as twenty allocations of 100 tNFIVE each
   (2,000 total). The original 10k planned amount is kept in an audit
   event. The old batch ID/operation keys are reused, never duplicated.
   If already signed or inconsistent, the operation fails closed.
3. Leave AUTO_REWARDS_ENABLED=false and MANUAL_REWARDS_ONLY=true. Run the
   Wallet Worker deployment and test the new two-step admin flow first.
   The deployment remains in safe mode with TRANSFERS_ENABLED=false.
4. After confirming the exact Batch, existing custody addresses, no
   historical paid rewards, and sufficient on-chain test POL, **manually
   enable only TRANSFERS_ENABLED=true in the Wallet Worker**. This is a
   separately controlled go-live operation; /admin cannot silently
   change Cloudflare configuration. Do not turn on automatic rewards.
   In MANUAL_REWARDS_ONLY mode, the cron can sign **only** when a
   specifically approved batch has a separate active payout run.
   Previously approved but unactivated batches NEVER send.
5. Press **تست یک تراکنش**, inspect the exact batch/budget, then press
   the final confirmation within five minutes. The next Wallet cron
   tick sends **one real Amoy testnet ERC-20 transfer** and waits for
   blockchain confirmation including a matching Transfer event.
6. **Do not start full distribution until PILOT_OK** appears on /admin.
   Check the pilot's Polygonscan receipt and token amount. Press
   **توزیع باقی دریافت‌کنندگان**, followed by separate confirmation.
   A single serialized transaction is processed each minute. Further
   transfers stop if a job fails or needs review.
7. After welcome succeeds, return to **جایزه هفتگی**. This uses the
   last fully completed Tehran Saturday-to-Saturday period and the
   approved 10,000 tNFIVE pool, split 40% equally / 60% by rank.
   Prepare the weekly Batch, test one recipient, then explicitly
   confirm its remaining recipients.
8. Track /admin > **وضعیت توزیع و پیام‌ها** and each Batch detail:
   confirmed/pending/unsent/failed on-chain transfers and Telegram
   notification counts. User messages are sent only after verified
   receipts and claimed at most once. Their status can be reviewed.
9. **توقف انتقال‌های بعدی** is available even if RPC fails. It stops
   future transactions but cannot cancel an already signed/broadcast
   blockchain transfer.

## Display format

Amounts are rounded for UI only: NFIVE has at most two displayed decimals,
POL at most four decimals, and public wallet addresses appear abbreviated
in Telegram. The underlying raw balances, transaction allocations, keys
and Polygonscan URLs remain untouched. Admin wallet view keeps a one-tap
copy of the unabridged Distributor address.

## Safety requirements

- Never paste API credentials or private keys in chat or code.
- Do not rotate WALLET_ENCRYPTION_KEY or recreate the existing wallets.
- TRANSFERS_ENABLED=false remains the committed/deployed default.
- AUTO_REWARDS_ENABLED=false always remains disabled for this first rollout.
- MANUAL_REWARDS_ONLY=true blocks unrelated withdrawals and unapproved
  reward batches while the operator campaign is active.
- Two-step /admin confirmation tickets are one-use and expire in five minutes.
- Preflight validates 80002, exact reward allocations, fund availability
  and estimated POL + safety margin *before* accepting a payout run.
- Signed transactions are persisted before RPC broadcast, and replayed
  with the same signed bytes when receipts are ambiguous.
- No on-chain transfers happen upon GitHub PR merge or Wallet deployment.

## Deployment

Merge only with both Telegram and Wallet checks green. The bot auto-deploys.
Manually invoke GitHub Action **Deploy N5 Wallet (Amoy manual)** on main,
which applies migration 0003 and sets MANUAL_REWARDS_ONLY=true with both
financial toggles still false. Check /admin before enabling transfer mode.
