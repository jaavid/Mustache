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

`ADMIN_TELEGRAM_USER_ID=208627` does not activate an admin interface:
a separate reviewed implementation is required for privileged Telegram actions.
