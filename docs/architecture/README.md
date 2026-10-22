# Architecture: current state and migration target

This directory holds the long-lived architecture documentation. For gameplay and
security invariants see [../ARCHITECTURE.md](../ARCHITECTURE.md); for decisions see
[../adr/](../adr/README.md).

## Current state (baseline: commit `20f9d27`, 2026-10-22)

```text
                         Telegram (users)
                                │
                ┌───────────────┴────────────────┐
                │                                │
        Telegram Game Card                Wallet commands
                │                                │
                ▼                                ▼
   ┌────────────────────┐          ┌──────────────────────────┐
   │ Game client        │          │ Telegram bot Worker      │
   │ Phaser 4 / Vite    │  HTTPS   │ bot/  (Cloudflare)       │
   │ mustache.alexa.ir  │─────────▶│ mustache.zedai.ir        │
   └────────────────────┘  /api/*  └───────┬──────────┬───────┘
                                            │          │
                                   D1 scores│          │ WALLET service binding
                                            ▼          ▼
                                  ┌──────────────┐  ┌──────────────────────┐
                                  │ D1           │  │ Wallet Worker        │
                                  │ n5-mustache- │◀─│ wallet/ (Amoy 80002) │
                                  │ scores       │  │ n5-wallet-service-   │
                                  └──────────────┘  │ amoy + D1 wallet DB  │
                                                    └──────────┬───────────┘
                                                               │ JSON-RPC
                                                               ▼
                                                    Polygon Amoy testnet
```

- The game is static; GitHub Pages serves the Vite build.
- The bot is the only public API for competitive rounds; it recalculates submitted
  traces and updates Telegram scores.
- The bot normally calls the Wallet Worker through its `WALLET` service binding; an
  authenticated HTTPS fallback via `WALLET_API_URL` also exists. Internal routes require
  the shared service key. The public Worker host also exposes an admin-token-protected
  operator HTTP API. The wallet reads the scores D1 for ranking/reward planning and owns
  custody/payout data in its own D1. Its scores binding is not read-only at the platform level.
- `shared/` contains deterministic plain-JS rules (`goldenRules.js`, `modeRules.js`)
  imported by both the game build and the bot bundle. Game-side TS logic lives in
  `src/logic/`; the server duplicate lives in `bot/src/scoring.js`.

### Known structural gaps (baseline)

| Gap                                                                                                  | Impact                                        | Planned phase |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------- |
| No npm workspace or single root lockfile; bot has no manifest, wallet installs with `npm install`    | Non-reproducible installs, unclear boundaries | Phase 3       |
| Scoring/mode formulas duplicated between `src/logic/` and `bot/src/scoring.js`                       | Divergence risk for competitive scores        | Phase 4       |
| Large mixed-responsibility modules (`src/game/scenes.ts`, `bot/src/index.js`, `wallet/src/index.js`) | Hard to test and review                       | Phase 5       |
| No architecture contracts package or contract tests                                                  | Cross-app assumptions stay implicit           | Phase 4       |
| No release/observability process, no rollback runbooks                                               | Harder incident response                      | Phase 6       |

See the [baseline audit](BASELINE_AUDIT_2026-10-22.md) for the full risk register.

## Target structure (incremental, not immediate)

```text
mustache/
├── apps/
│   ├── game/
│   ├── telegram-bot/
│   └── wallet-worker/
├── packages/
│   ├── game-rules/
│   ├── contracts/
│   └── shared-types/
├── tooling/
├── docs/
│   ├── architecture/
│   ├── adr/
│   └── runbooks/
├── .github/
│   ├── workflows/
│   ├── CODEOWNERS
│   └── dependabot.yml
├── package.json
└── package-lock.json
```

This is a direction, not a mandate to move everything now. Each application keeps a
clear boundary, and each migration ships as its own reviewable PR with behavior
preservation evidence.

## Non-negotiable boundaries

1. A deployable application must not import another application's private modules.
2. `packages/game-rules` and `packages/contracts` must stay free of Phaser, DOM,
   Cloudflare runtime bindings, D1, viem and blockchain types. Runtime-specific
   adapters stay inside the consuming app.
3. Cross-application communication uses explicit, versioned contracts (HTTP JSON
   shapes, service-binding request/response contracts, error codes), validated at the
   untrusted boundary.
4. Gameplay calculations stay deterministic, pure and independently testable.
5. Cloudflare Worker-to-Worker service bindings, Worker names, D1 databases, domains
   and deployment identities are preserved.
6. No circular dependencies. Shared packages depend only on standard JavaScript/TypeScript
   and each other in one direction.
7. Dependency injection is used where it materially improves testing (I/O adapters,
   fetchers, clocks); no generic repositories, factories or DI containers without a
   concrete need.

## Migration sequence

| Phase | Branch                             | Scope                                                               | Status    |
| ----- | ---------------------------------- | ------------------------------------------------------------------- | --------- |
| 1     | `chore/repository-governance`      | Governance, templates, standards, ADRs, documentation corrections   | In review |
| 2     | `ci/quality-gates`                 | Aggregated CI gate, deterministic checks, deployment separation     | Planned   |
| 3     | `refactor/npm-workspaces`          | npm workspaces, single lockfile, deterministic installs, Dependabot | Planned   |
| 4     | `refactor/shared-domain-contracts` | Shared gameplay rules/contracts, differential and contract tests    | Planned   |
| 5     | `refactor/modular-*`               | Bot, wallet, game responsibility splits (separate PRs)              | Planned   |
| 6     | `chore/release-engineering`        | Release/observability/rollback documentation                        | Planned   |

Each phase starts from the latest `main` after the previous phase is merged. A later
phase must not silently stack on an outdated base.

## Deployment and data constraints for every migration

- Preserve https://mustache.alexa.ir/, https://mustache.zedai.ir/, Worker names and the
  `WALLET` service binding.
- Vite must keep relative asset paths for GitHub Pages custom domain + project subpath.
- Wrangler must still resolve local dependencies during bundling.
- D1 migrations stay additive and backward compatible; never destructive.
- Keep committed wallet flags false; no blockchain transactions in CI.
- Update this document and add an ADR when a phase changes a boundary or dependency
  direction.

## How to update this document

Architecture changes ship in the same PR as the code. Update the current-state diagram,
the boundary rules if needed, and link the relevant ADR. Do not describe target
structure as if it already exists.
