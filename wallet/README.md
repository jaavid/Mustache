# N5 Wallet Service — Polygon Amoy testnet

Separate Cloudflare Worker within the existing `jaavid/Mustache` monorepo. **TESTNET ONLY**; no real-value awards. Existing Telegram webhook and scores Worker remain unchanged by this directory.

- Polygon Amoy: `80002`
- NFIVE contract: `0xb0762E4EB2a1c4e4c3d65b93048972aBB60dFaa7`
- Treasury public address (no key in code): `0x45046A011987c5CB76AfCc0249730697E7C7efa7`
- Wallets indexed by numeric Telegram User ID, **not display name**.
- D1 encrypted private keys (AES-GCM, unique nonce and AAD per player), D1 immutable signed-transaction journal, global serial Durable Object.
- Game D1 is read solely for completed Tehran-week snapshots. Existing score verification is not prize-grade.
- Weekly pool is `10000` test tNFIVE by default; 40% participation + 60% rank. No minted or transferred tokens until explicitly configured.

## Production deployment (manual approval)

This PR has no automatic wallet deployment and **cannot move assets just by being merged**.

1. Make sure the Wallet CI workflow passes. `cd wallet && npm install && npm run check`.
2. Create a **new** D1 database: `npx wrangler d1 create n5-wallet-db`; obtain its UUID. Keep existing scores database `n5-mustache-scores` intact.
3. In `wallet/wrangler.jsonc`, replace the first database UUID with wallet D1 UUID, and the second with the existing scores D1 UUID. Do this via trusted deployment configuration, not by committing production secrets. The placeholder `00000000-...` MUST be replaced before live deploy.
4. `cd wallet && npx wrangler d1 migrations apply DB --remote`, then `npx wrangler deploy`.
5. Configure secrets with `npx wrangler secret put AMOY_RPC_URL`, `ADMIN_API_TOKEN`, `WALLET_ENCRYPTION_KEY` and `WALLET_SERVICE_KEY`. Generate the admin/service token with `openssl rand -hex 32`; encryption key with `openssl rand -base64 32` and **back it up securely**. NEVER paste values into GitHub, chat, issue or log.
6. Generate **a distinct, limited-funds operational wallet outside this repository**. Fund it from the original admin wallet with small quantities of tNFIVE and test POL; never use the treasury/admin key as `DISTRIBUTOR_PRIVATE_KEY`. Configure `npx wrangler secret put DISTRIBUTOR_PRIVATE_KEY` using a protected local console. The API rejects accidental use of the treasury key.
7. Call `GET /admin/preflight` with `Authorization: Bearer <ADMIN_API_TOKEN>`. Confirm contract bytecode, chain 80002, ERC-20 symbol/decimals, admin and operational balances. Stop if unexpected.
8. Export real Telegram IDs from the existing scores D1: `SELECT CAST(user_id AS TEXT) AS telegramUserId,display_name AS displayName FROM game_users ORDER BY user_id;`. Pick exactly the authorized test users and `POST /admin/bootstrap` with `{"players":[{"telegramUserId":"1234","displayName":"Member"}]}`. Repeat is idempotent.
9. `POST /admin/batches` using `{"batchId":"genesis-0","allocations":[{"telegramUserId":"1234","amount":"10"}]}`. No chain transaction occurs yet.
10. Verify a small test transfer and reconcile receipt using `POST /admin/process`. First turn `TRANSFERS_ENABLED` to `true` in **trusted deployment configuration** and redeploy; keep default `false` in Git. Run `GET /admin/overview` and Polygonscan.
11. Before weekly automation, confirm all eligible users have wallets and score rules are appropriate. Enable `AUTO_REWARDS_ENABLED` only after explicit review. Cron **Friday 20:35 UTC = Saturday 00:05 Tehran** creates a snapshot for the completed week; a 10-minute Cron resumes submitted jobs. On RPC ambiguity, only the persisted signed payload may be rebroadcast, never a newly signed transaction.

Note: The deployed code cannot be meaningfully end-to-end tested for real token delivery until Cloudflare secrets, active Amoy RPC, D1 bindings, and distributor wallet are provided by the account administrator. CI covers pure logic and deployment bundling.

## API

Admin routes (Bearer admin token):
- `GET /admin/preflight`
- `POST /admin/bootstrap` (create encrypted per-user wallets)
- `POST /admin/batches` (immutable idempotent batch plan)
- `POST /admin/process` (advance one tx job through serial coordinator)
- `POST /admin/weekly/plan` (manual prior-week dry planning)
- `GET /admin/overview`

Internal bot routes (Service Binding AND `X-Wallet-Service-Key` and server-derived `X-Telegram-User-Id`):
- `GET /internal/wallet`
- `GET /internal/history`
- `POST /internal/withdrawals` with `{"destination":"0x...","amount":"50"}`
- `POST /internal/withdrawals/<uuid>/confirm` from an authenticated Telegram callback.

Only invoke internal routes from the trusted Telegram webhook, never from the client. Require **private Telegram chats** for sensitive wallet commands, and verify the callback belongs to the requesting Telegram user. The bot integration must be deployed after the Wallet Worker/service secrets are configured.

## Custody and incident handling

- D1 never stores plaintext private keys, but its encrypted keys still make this a **custodial** service. The Worker encryption secret is crucial: restore testing is essential.
- Signed raw transactions in D1 are already authorized for their specific nonce/recipient/amount; protect D1 read access. Replay of the *same* raw tx cannot create a second transfer, while resubmitting a *newly signed* tx can.
- Durable Object serializes tx creation to avoid competing nonces. `SIGNED` or `SUBMITTED` tx states block new nonces from the same sender until a receipt is known. A stuck tx requires manual inspection; no automatic fee bump.
- Never enable public user wallet creation, export-key APIs, arbitrary contract calls or open withdrawals.
- The gas station only covers **a bounded withdrawal** from a registered user; default cap 0.005 test POL per funding request and 1000 tNFIVE per withdrawal. Monitor funding wallet/testnet faucet depletion.
- To pause signing immediately set `TRANSFERS_ENABLED=false` and deploy; outstanding signed raw transfers may still be accepted by the chain.
- In case of RPC errors or nonce collisions reconcile the transaction hash via Amoy Polygonscan and D1 first. Do not blindly reset records.
- **Not exchange-ready**: Swap, AMM pool creation and ERC-20 allowance management are separate reviewed phases. Holding mock USDC/WETH in the treasury does not establish a tradable market.
