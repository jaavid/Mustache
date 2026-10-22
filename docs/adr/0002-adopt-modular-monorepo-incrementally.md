# ADR-0002: Adopt a modular monorepo and migrate incrementally

- **Status:** Accepted (direction); implementation is phased
- **Date:** 2026-10-22
- **Deciders:** repository owner (@jaavid)
- **Related:** [Current/target architecture](../architecture/README.md), [baseline audit](../architecture/BASELINE_AUDIT_2026-10-22.md)

## Context

The repository currently contains:

- a Phaser 4 + TypeScript + Vite game in `src/`, deployed to GitHub Pages;
- a Telegram bot Cloudflare Worker in `bot/` with its own D1 schema;
- a Polygon Amoy testnet Wallet Worker in `wallet/` with a separate D1 schema, manual
  deployment and strict payout safety rules;
- deterministic rules in `shared/` imported by both the game and the bot.

There is no npm workspace or single lockfile, the bot has no `package.json`, the wallet
is installed with `npm install`, CI checks are fragmented across path-filtered
workflows, and scoring logic is partly duplicated between the client and the Worker.
Despite this, the components are already deployed independently, with production
domains, D1 databases, Worker names, a service binding and a manual wallet release
process that must keep working.

A full rewrite or a large-bang repository restructure would create unacceptable risk to
gameplay, leaderboards, Telegram sessions and wallet safety.

## Decision

Adopt a **modular monorepo** as the target architecture and migrate toward it
incrementally, one reviewable phase at a time:

1. `apps/game`, `apps/telegram-bot`, `apps/wallet-worker` become the deployable
   boundaries.
2. `packages/game-rules`, `packages/contracts`, `packages/shared-types` hold shared,
   runtime-agnostic logic and typed contracts.
3. `tooling/` holds repository-wide development tooling that is not shipped.
4. `docs/{architecture,adr,runbooks}/` holds decisions and operational procedures.
5. Use **npm workspaces** and a single root lockfile. Do not introduce Nx, Turborepo,
   pnpm, Kubernetes or microservices without measured justification and a new ADR.

Hard constraints for every migration step:

- preserve existing behavior, game mechanics, scoring, leaderboards, Telegram
  authentication/sessions, wallet custody and audit controls;
- preserve Cloudflare Worker-to-Worker service bindings, Worker names, D1 databases,
  domains and deployment identities;
- keep wallet transfers and automatic rewards disabled by default;
- no destructive database migrations and no production deployment as part of a
  repository refactor;
- no app may import another app's private modules, and shared packages must not depend
  on Phaser, Cloudflare bindings, viem or blockchain infrastructure;
- each phase starts from the latest `main`, ships its own tests/docs/rollback notes and
  is merged before the next dependent phase begins.

The phases are recorded in [docs/architecture/README.md](../architecture/README.md).
This ADR decides the destination and migration method; the exact package APIs, module
splits and release process are decided in later ADRs (Phases 4–6).

## Alternatives considered

| Alternative                              | Why not chosen                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Leave the flat layout as-is              | Dependency boundaries and installs stay ambiguous; duplicated logic keeps drifting; CI remains fragmented   |
| One large-bang restructure PR            | Unreviewable and high risk to deployments, D1 data, Telegram sessions and wallet safety                     |
| Multiple independent repositories        | Loses atomic cross-cutting changes, shared tests and a single audit trail for wallet/game contracts         |
| Nx/Turborepo/pnpm microservice setup     | Unjustified operational complexity for three small deployables; violates "simple, explicit" preference      |
| Client/server shared code for everything | Would drag Phaser/DOM or Cloudflare/viem types across boundaries; runtime-specific code must stay app-local |

## Consequences

### Positive

- Clear deployable boundaries and review ownership.
- Reproducible installs and a single dependency graph.
- Shared rules and contracts become testable once, with differential tests protecting
  existing behavior.
- Deployments remain independent and controlled.

### Negative / accepted trade-offs

- The repository will temporarily contain both old and new layout during migration.
- Workspace migration touches every build, test and deployment command; each must be
  verified against Wrangler bundling and GitHub Pages before the old path is removed.
- More documentation and ADRs to maintain.

### Risks and mitigations

- **Wrangler bundling breaks** when packages move: keep a dry-run bundle check in every
  migration PR and verify the committed Wrangler entry points still resolve.
- **Pages base paths break** when the game moves: keep Vite `base: './'` and verify the
  production URL after merge.
- **D1 history or data loss**: migrations stay additive; never reset or recreate
  production databases; schema compatibility rules are documented before any change.
- **Wallet safety weakening**: transfers/automatic rewards stay false and manual-only
  rewards stay true; wallet deployment remains
  manual; custody/signing changes are explicitly out of scope for refactors.

## Compatibility and rollout

- Behavior change: none by itself; changes happen in later phases.
- Deployment impact: none in Phase 1; later phases preserve domains and triggers.
- Data impact: none.
- Security impact: none in Phase 1; boundaries reduce accidental coupling.
- Rollback: each phase is a revertible PR; no phase rewrites shared history.

## Follow-ups

- ADR for npm workspaces and the lockfile (Phase 3).
- ADR for shared rules/contracts and their runtime validation (Phase 4).
- ADRs for module splits (Phase 5).
- ADR for release/versioning/observability (Phase 6).
