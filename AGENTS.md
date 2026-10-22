# Agent instructions — Mustache Mayhem

This repository has three independently deployed components (game, Telegram bot,
testnet wallet Worker) and a shared rules directory. Preserve behavior, user experience,
leaderboard data and wallet safety at all times.

## Read before changing anything

- [Architecture and invariants](docs/ARCHITECTURE.md) and
  [current-state/target architecture](docs/architecture/README.md)
- [Engineering standards](docs/ENGINEERING_STANDARDS.md)
- [Trunk-based workflow and Conventional Commits](docs/GIT_WORKFLOW.md)
- [Governance and branch protection](docs/GOVERNANCE.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Baseline audit and known risks](docs/architecture/BASELINE_AUDIT_2026-10-22.md)
- Wallet work: `wallet/README.md` and the wallet runbooks.

## Hard rules

- **Never push directly to `main`**, force-push, rewrite shared history, or merge a pull
  request. Work on a short-lived branch and let a human review and merge.
- **Never expose, log, commit, rotate or invent credentials.** No secrets, private keys,
  tokens, `.dev.vars`, Telegram identities or production data in code, tests, logs,
  issues, PRs or chat.
- **Never run production deployment or migration commands** as part of local
  verification. Never execute blockchain transactions, sign/approve/broadcast token
  transfers, or enable automatic token rewards.
- **Preserve the safe wallet defaults** unless a separately reviewed and explicitly
  authorized go-live change says otherwise: `TRANSFERS_ENABLED=false`,
  `AUTO_REWARDS_ENABLED=false`, `MANUAL_REWARDS_ONLY=true`.
- **Do not change** the Polygon Amoy chain ID (`80002`), deployed contract address,
  treasury/distributor addresses, signing keys, custody model, D1 databases, Telegram
  authentication/webhooks/sessions, leaderboard records or production domains.
- **Do not change gameplay or scoring behavior** in governance, CI, refactor or
  documentation PRs. Do not silently fix unrelated bugs.
- **Never disable, skip or weaken tests/assertions** to make CI green. If a check cannot
  run, report that explicitly; never claim an unexecuted check passed.
- **Respect module boundaries:** the game must not import bot/wallet internals; the bot
  and wallet must not import Phaser or game internals; `shared/` must stay
  runtime-agnostic (no Phaser, Cloudflare bindings, viem, DOM).
- **Never claim prize-grade anti-cheat.** Client-controlled positions are untrusted; see
  [issue #6](https://github.com/jaavid/Mustache/issues/6).

## Current architecture (verified 2026-10-22, commit `20f9d27`)

- **Game client** — `src/`: Phaser 4.2.1 + TypeScript + Vite. Deployed to GitHub Pages
  at https://mustache.alexa.ir/ on every push to `main` (`pages.yml`). Build uses Vite
  `base: './'`; keep 960×540 desktop and 540×960 portrait layouts.
- **Telegram bot** — `bot/`: plain ESM JavaScript Cloudflare Worker, D1
  `n5-mustache-scores`, `WALLET` service binding, custom domain
  https://mustache.zedai.ir. `deploy-cloudflare-worker.yml` deploys for changes to
  `bot/**`, `shared/**` or that workflow on `main`, or via manual dispatch.
- **Wallet Worker** — `wallet/`: plain ESM JavaScript Cloudflare Worker on Polygon Amoy
  (80002), D1 `n5-wallet-db` plus scores D1 (read-only by code convention, not binding permissions), `WalletSerial` Durable
  Object. **Testnet only.** Deploys **manually** through `deploy-wallet.yml`
  (`workflow_dispatch`), with transfers and automatic rewards disabled by default.
- **Shared** — `shared/goldenRules.js` and `shared/modeRules.js` are plain ESM rules
  used by both the game and the Worker. Game-side pure TS logic lives in `src/logic/`;
  server score re-validation lives in `bot/src/scoring.js`.
- The target `apps/*` + `packages/*` monorepo layout is recorded in ADR-0002 and is
  migrated incrementally in separate PRs. Do not move files outside an approved phase.

## Commands

Node.js 22. From the repository root:

```sh
npm ci
npm run format:check
npm run lint
npm run assets:check
npm run docs:check
npm run typecheck
npm test
npm run test:bot
npm run build
npm run test:e2e   # Playwright; requires installed browsers
```

Wallet (separate dependency tree today; workspaces are a separate phase):

```sh
cd wallet
npm install --no-audit --no-fund
npm run check
npx wrangler deploy --dry-run --outdir /tmp/wallet-dist
```

Worker bundling dry runs never deploy. Do not use real credentials for dry runs.

## Gameplay invariants to preserve

- Maintain `960×540` desktop/landscape and `540×960` mobile portrait with FIT scaling.
  Keep scene-specific gameplay coordinates in Phaser space, not raw DOM coordinates.
- Prefer pixel-art generated sprites and crisp nearest-neighbor rendering. Avoid remote
  runtime assets that could break on GitHub Pages.
- Keep scoring/geometry logic pure and tested in `src/logic/`; `resolveRoundShot` is
  shared by desktop and portrait and must run once per shot.
- Scoring happens at projectile impact; never before the mustache visually arrives.
  Appearance serials invalidate stale timeouts; one shot per pop; mobile-safe X.
- Cosmetic accessories stay aligned to the 210×362 sprite and must not cover the mouth.
  Fake-outs cannot reduce combo. Double-pop follow-up uses a different tree. Bonuses
  only on confirmed projectile impact.
- Pause and tutorial overlays run independently of the paused Play scene. Stop music on
  scene shutdown/orientation remount. Record stats only at projectile impact.
- Keep the three tested round phases (0–15, 15–30, 30–45 s) and fair minimum exposure.
  Keep extra VFX behind input UI and avoid overlap on 540×960. Respect reduced motion.
- `RaminMoments` overlays must not displace the active hero/lip hitbox. `onHit` only
  after impact evaluation; slip only once the target is inactive. `moments.clear()` on
  next spawn; render `moments.update()` after accessory sync. Desktop/mobile symmetric.
- Use `evaluateAim` for true-aim elliptical lip scoring. GOOD/PERFECT must land at the
  pointer location via the rotated local sticker anchor (no snap to lip center). Tree
  misses require bark collision; other misses fall. Desktop/mobile parity.
- Ramin facial expressions use only whole sprite frames from `ramin-face-atlas-v2`;
  never paint separate eyes/eyebrows. Do not shift the 210×362 lip calibration.
  `RaminMomentController` cancels stale resets on impact/next spawn.
- The three playable heroes (Ramin, Borhan, Mammad) share scoring/hit zones; mustache
  variants and accessories are cosmetic.
- Golden Mustache: deterministic pickup schedule; server validates pickups and
  golden-perfect claims; +350 only on PERFECT golden shot; progress is not a token/NFT.
- Gold Rush: shared mode rules (`shared/modeRules.js`); +50 PERFECT and +150 every third
  consecutive perfect; separate scoreboard; no reward-eligibility changes.
- README describes only current mechanics; historical notes belong in CHANGELOG.
- New assets must update `assets/manifest.json`; screenshots are human-review artifacts,
  not pixel-diff baselines.

## Wallet safety

Before touching `wallet/` or `bot/src/walletCommands.js`/`adminDashboard.js`, read the
wallet runbooks. Preserve idempotency, nonce management, the signed-transaction journal,
receipt/reconciliation rules, payout audit trails, two-step confirmations, rate limits,
gas caps, shared-key service auth, server-derived Telegram identity and private-chat
enforcement. Any change involving real signing authority, custody, reward distribution
or financial transactions must be isolated in its own PR and flagged for explicit human
review. Never rotate `WALLET_ENCRYPTION_KEY`, share `DISTRIBUTOR_PRIVATE_KEY` or modify
production D1 data.

## Pull requests and verification

- Use Conventional Commits and the PR template. Keep one concern per PR; include tests
  and documentation in the same PR.
- Include exact verification commands/results and any skipped checks with reasons.
- Report honestly if tools, permissions or review access are unavailable. Never
  fabricate a PR, workflow run or deployment.
