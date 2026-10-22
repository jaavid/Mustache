# Architecture and invariants

Mustache Mayhem is a single Git repository with **three independently deployable
components** and one shared directory of runtime-agnostic rules. The game client is
plain browser code; the Telegram bot and the wallet Worker are separate Cloudflare
Workers with separate D1 databases and separate deployment lifecycles.

| Component     | Code today                      | Runtime                                                                | Deployment                                                                |
| ------------- | ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Game client   | `src/`, `index.html`, `assets/` | Browser: Phaser 4.2.1, TypeScript, Vite                                | GitHub Pages on every push to `main` (`pages.yml`)                        |
| Telegram bot  | `bot/`                          | Cloudflare Worker, D1 `n5-mustache-scores`                             | `deploy-cloudflare-worker.yml` for `bot/**`/`shared/**` changes on `main` |
| Wallet Worker | `wallet/`                       | Cloudflare Worker, D1 `n5-wallet-db` + scores D1 (reads by convention) | **Manual** `workflow_dispatch` only (`deploy-wallet.yml`)                 |
| Shared rules  | `shared/`                       | Plain ESM JavaScript, no runtime APIs                                  | Bundled into the game and the bot at build time                           |

The target modular-monorepo layout (`apps/*`, `packages/*`) and the incremental
migration rules are documented in [docs/architecture/README.md](architecture/README.md)
and [ADR-0002](adr/0002-adopt-modular-monorepo-incrementally.md). This document
describes the system that exists **today** plus the invariants every migration must
preserve.

## Trust boundaries

- **The browser is untrusted.** It renders the game and submits impact traces for
  Telegram rounds. The Worker recalculates arithmetic and geometry, but the animated
  target and client clocks are still browser-controlled. This is **not** prize-grade
  anti-cheat; see [issue #6](https://github.com/jaavid/Mustache/issues/6).
- **Telegram authentication is server-side.** The bot issues short-lived bearer
  sessions after a verified Game callback and derives player identity from Telegram
  data, never from client-supplied user IDs.
- **The wallet is isolated from the game client.** Current browser code does not call
  the Wallet Worker. The bot calls authenticated internal wallet routes through the
  `WALLET` service binding or an HTTPS fallback (`WALLET_API_URL`), with a shared internal
  key and server-derived Telegram identity. A public Worker host is not itself private;
  authentication, not the binding alone, protects these routes.
- **The game client never touches custody or signing.** No gameplay path can sign or
  broadcast a transaction.

## Data ownership

- `n5-mustache-scores` (D1): bot-owned game rounds, sessions, leaderboards,
  progression and verified gameplay metrics. The Wallet Worker reads it for weekly
  snapshots, genesis planning and ranking/operator views. Read-only access is a code
  convention: the D1 binding itself grants read/write access. Deployment operators must
  verify the wallet's scores UUID matches the bot's injected database UUID.
- `n5-wallet-db` (D1): wallet-owned encrypted key material, batches, signed transaction
  journal, payouts and reward notifications.
- Browser `localStorage`: practice statistics only. It never authorizes rewards.

## Round lifecycle (game client)

1. The responsive entry point chooses the 960 × 540 or 540 × 960 scene.
2. The boot scene preloads the selected hero sprite and registers procedural textures.
3. A tree, pose and spawn event are selected; the active hero becomes scorable only
   after entering.
4. A tap or click launches a projectile toward that **exact pixel**.
5. At projectile impact, `resolveRoundShot` computes the grade, points, combo,
   character reward and round statistics _once_.
6. The scene renders reaction/effects and queues the next spawn.
7. After 45 seconds, the local result screen displays the score, medals and missions.

## Non-negotiable gameplay invariants

- One shot per appearance; never score before projectile arrival.
- The target is a **horizontal ellipse around the rotated upper-lip reference**, not
  the whole face.
- The visual mustache stays anchored to the actual landing coordinate as the hero
  moves; never snap a GOOD hit to the perfect center.
- Only bark collision allows a MISS to stick on a tree.
- Mustache variants and accessories remain cosmetic; fake-outs do not penalize combo.
- Brow/eye animations must use **whole expression frames** for each hero—never paint a
  second set of brows over an existing face.
- Hand touches and slips must not move a scorable hitbox; avoid stale idle-reset timers
  overriding new impact expressions.
- No local score can authorize token rewards.
- Respect pause, reduced-motion settings and the 0–15/15–30/30–45 stage boundaries.
- The three heroes (Ramin, Borhan, Mammad) share the same scoring and hit-zone rules.

## Scene separation

Desktop and portrait scenes intentionally have different rendering and input layout.
Scoring logic is unified in `src/logic/shotResolution.ts`; future consolidation of
scene rendering belongs in a separate, reviewed refactor (Phase 5).

## Quality gates

Use lockfile-based `npm ci`, Prettier, ESLint, TypeScript strict, Vitest, the bot and
wallet `node:test` suites, and Playwright browser smoke checks. Screenshots are review
artifacts, not visual-diff acceptance gates. See
[Engineering standards](ENGINEERING_STANDARDS.md) and
[CI quality gates](GOVERNANCE.md#4-ci-quality-gates).

## Telegram backend boundaries

- `bot/src/index.js`: BotFather Game webhook, authenticated score APIs and native
  Telegram score updates; composes the other bot modules.
- `bot/src/sessions.js`: secure callback-issued bearer sessions, D1 rounds and
  multi-period ranking queries.
- `bot/src/periods.js`: Saturday-to-Saturday Asia/Tehran boundaries and Solar Hijri
  month windows.
- `bot/src/scoring.js`: server re-evaluation of client impact traces, with bounded
  timing and geometry; imports `shared/goldenRules.js` and `shared/modeRules.js`.
- `bot/src/adminDashboard.js`, `walletCommands.js`, `walletDiagnostics.js`: operator and
  wallet-facing Telegram flows. Wallet commands fail closed when the Wallet Worker is
  unavailable.
- `src/platform/competitiveScores.ts`: client transport for the bot API; failures never
  block local play.
- `bot/migrations/`: D1 schema applied before Worker deployment, additively.

**Do not confuse server score arithmetic checks with full anti-cheat.** The client
controls the animated target; cryptocurrency rewards remain disabled by default and
must not be enabled from leaderboard data.

## Wallet boundary (Polygon Amoy testnet only)

- Chain ID `80002`; deployed NFIVE contract `0xb0762E4EB2a1c4e4c3d65b93048972aBB60dFaa7`;
  no key material in source control.
- Custodial testnet service: encrypted per-player keys in D1, a signed-transaction
  journal, a global serial Durable Object for nonce safety, idempotent batches, receipt
  and Transfer-event verification, and payout audit trails.
- Committed safe defaults: `TRANSFERS_ENABLED=false`, `AUTO_REWARDS_ENABLED=false`,
  `MANUAL_REWARDS_ONLY=true`. The manual deploy workflow asserts these values.
- Deployment is manual dispatch only. Enabling transfers, automatic rewards, changing
  signing/custody or rotating keys requires a separate reviewed go-live change and
  explicit human authorization.
- Runbooks: [Wallet overview](../wallet/README.md),
  [distribution](../wallet/DISTRIBUTION_RUNBOOK.md),
  [admin payouts](../wallet/ADMIN_PAYOUT_RUNBOOK.md),
  [auto-provisioning and Telegram](../wallet/AUTO_PROVISION_AND_TELEGRAM.md),
  [deployment](N5_WALLET_DEPLOYMENT.md), and the
  [runbook index](runbooks/README.md).

## Deployment topology

| Surface                    | Owner                   | Trigger                                           |
| -------------------------- | ----------------------- | ------------------------------------------------- |
| https://mustache.alexa.ir/ | GitHub Pages (game)     | push to `main` or manual dispatch                 |
| https://mustache.zedai.ir/ | Telegram bot Worker     | push to `main` affecting `bot/**`/`shared/**`     |
| `n5-wallet-service-amoy`   | Wallet Worker (testnet) | manual dispatch with environment `wallet-testnet` |

Existing domains, Worker names, D1 bindings and service bindings are production
identities and must not be renamed or replaced as part of repository refactoring.

## Governance and future architecture

- [Current state and target architecture](architecture/README.md)
- [Architecture Decision Records](adr/README.md)
- [Engineering standards](ENGINEERING_STANDARDS.md)
- [Governance](GOVERNANCE.md) and [trunk-based workflow](GIT_WORKFLOW.md)
- [Baseline audit and risk register](architecture/BASELINE_AUDIT_2026-10-22.md)
