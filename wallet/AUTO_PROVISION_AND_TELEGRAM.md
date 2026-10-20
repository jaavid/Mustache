# Automatic wallet provisioning and Telegram Wallet UI

This change keeps the existing 20 custodial wallets. It adds a **private internal**
`POST /internal/wallet/ensure` endpoint to the N5 Amoy Wallet Worker. The
already authenticated `@RJTtobot` server passes its trusted
`message.from.id` or `callback_query.from.id` via the shared-key internal
request header, never via player-controlled JSON.

## Lifecycle

- New user sends `/start` or `/play` in a **private** Telegram chat:
  provision an encrypted wallet if missing, then continue with the Game Card.
- New user opens the official Telegram Game Card: provision from the verified
  game callback before starting the signed game session.
- `/wallet`, `/rewards`, or `/transactions`: provision on first use if
  needed. Old players keep their **identical** address and ciphertext.
- Wallet Worker/RPC unavailable: **do not block game sessions**; try again on
  the next authenticated action. Auto-provision only creates a local EOA
  record: **no POL, no ERC-20 transfer, no gas charge**.
- Never provision a wallet for bots, group members who have not authenticated
  individually, forwarded messages, or arbitrary user IDs supplied in chat.

## Bot UI

- Rich Telegram 10.2 blocks for wallet balances and reward/transaction tables.
- Clickable inline keyboard for Wallet, Rewards, Transactions, Withdrawal
  instructions, menu, and launching the game.
- On callbacks, edit the same private Telegram message instead of spamming
  a new message for each tab.
- Fallback to standard `sendMessage` or `editMessageText` **only** when the
  Bot API explicitly says rich blocks are unsupported. Do not fallback on
  timeouts/5xx (which could duplicate Telegram messages).
- Withdrawal remains a two-step explicit confirmation and is never executed
  directly by a navigation button. Existing rate limits and testnet gas caps
  remain enforced by the Wallet Worker.
- No new bot webhook. No additional shared secret or admin/private key needed.

## Release order

1. Merge after Wallet CI and bot integration CI both pass.
2. **Deploy Wallet Worker again manually** via the existing safe-mode
   [Deploy N5 Wallet (Amoy manual)](../.github/workflows/deploy-wallet.yml)
   workflow. Its default config still has
   `TRANSFERS_ENABLED=false`, `AUTO_REWARDS_ENABLED=false`.
   This installs the new ensure route.
3. The existing bot workflow deploys bot changes on merge; while the Wallet
   route is not yet available, auto-provision errors are handled without
   interrupting game launches.
4. In a private chat send `/wallet`, then use the inline keyboard.
   Existing users must see the SAME address as before; new users should
   appear in `n5-wallet-db.wallets` exactly once.
5. To verify backend counts:
   `SELECT COUNT(*) FROM wallets;`, and ensure wallet addresses are distinct.
   The count may grow beyond the original 20 as newly authenticated users join.
6. Keep the transfer and auto-reward flags disabled during UI rollout;
   wallet creation is independent of payment execution.

### Security note

The current arrangement uses `WALLET_SERVICE_KEY` on both Cloudflare Workers
as a service credential. Protect its value, configure HTTPS or a Cloudflare
Service Binding between Workers, and do **not** expose this route publicly
without service authentication. Player identity is server-derived only.

## Telegram management dashboard (read-only)

The private `/admin` command uses a **separate**, read-only internal
`GET /internal/admin/overview` route. It shows service switches, wallet
count, treasury/Distributor public balances, latest batches and transaction
state counts. It cannot approve batches, send NFIVE or expose private keys.

For the operator's Telegram account, configure the following **in BOTH the
`n5-mustache-rjttobot` and `n5-wallet-service-amoy` Workers**:

```text
ADMIN_TELEGRAM_USER_ID=208627
```

Provision this value as a Cloudflare secret (even though a numeric Telegram
ID is not itself a secret) so automated Worker code deployments preserve it
without hardcoding this account identifier into a public Git repository.
Never store `ADMIN_API_TOKEN` in the Telegram bot Worker.

Security enforces all of: valid Telegram webhook, private chat owner,
Telegram ID equality on the bot, shared-key Worker request, and server-side
operator ID equality on the Wallet Worker. There are **no admin write
endpoints** available through this Telegram interface.

Send `/admin` from the authorized Telegram account after redeploy and
confirm it shows the correct read-only wallet count. The command is not
placed in the global BotFather menu because ordinary players cannot use it.

## Troubleshooting /wallet after bot deployment

The Telegram bot command menu and rich keyboard being visible only proves that
the **Bot Worker** was deployed. Wallet balance requires a working connection
to the independent **Wallet Worker** and the correct per-bot credentials.

1. From [GitHub Actions](https://github.com/jaavid/Mustache/actions/workflows/deploy-wallet.yml),
   run `Deploy N5 Wallet (Amoy manual)` against `main`. A success is required
   for `POST /internal/wallet/ensure`; the bot itself is deployed on commits
   affecting `bot/**`.
2. In Cloudflare Worker `n5-mustache-rjttobot`, check the **presence** of
   `WALLET_API_URL=https://n5-wallet-service-amoy.zed-ai.workers.dev` and
   `WALLET_SERVICE_KEY` (matching the Wallet Worker's secret). Never reveal
   this secret to users, logs, issue comments or chat.
3. `GET https://n5-wallet-service-amoy.zed-ai.workers.dev/health` should
   return `chainId:80002` with `transfersEnabled:false` and
   `autoRewardsEnabled:false`. This health check **does not validate** the
   internal shared secret.
4. Set `ADMIN_TELEGRAM_USER_ID` to the approved numeric Telegram user ID
   in the bot Worker. The admin can run **`/walletcheck`** in a private
   Telegram chat to validate health, internal authentication, D1, and
   their own wallet without exposing API keys.
5. If the diagnostic says `401`, check the shared-key secret on **both**
   Workers. If `404`, confirm the Worker URL and redeploy the Wallet route.
   If `503`, verify Amoy RPC and Wallet Worker logs.
6. Share `https://t.me/RJTtobot?start=wallet` with users. The deep link now
   shows the wallet, rather than sending a Telegram Game Card.
7. Users with wallets built previously do not need individual enablement;
   `/wallet` must display the same address. A newly authenticated user is
   provisioned idempotently on private `/start` or first Wallet request.

**Never enable transfers or auto rewards to fix the /wallet command.**
Balance is a read-only operation.
