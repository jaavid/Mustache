# Contributing to Mustache Mayhem

Mustache Mayhem is a deliberately small monorepo with three independently deployable
components: a Phaser game on GitHub Pages, a Telegram bot Worker on Cloudflare, and a
manual-deploy testnet wallet Worker. Changes must preserve gameplay, Telegram behavior,
leaderboard records, wallet safety controls and production deployments.

Read these before making a non-trivial change:

- [Architecture and invariants](docs/ARCHITECTURE.md)
- [Current state and target architecture](docs/architecture/README.md)
- [Engineering standards](docs/ENGINEERING_STANDARDS.md)
- [Trunk-based development and commits](docs/GIT_WORKFLOW.md)
- [Governance, review and branch protection](docs/GOVERNANCE.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Runbook index](docs/runbooks/README.md)

## Prerequisites

- **Node.js 22** and npm (the lockfile is `lockfileVersion` 3).
- Git with access to the `jaavid/Mustache` GitHub repository.
- For wallet work: read the public [wallet runbooks](docs/runbooks/README.md) and
  establish an explicit human review path. Operational credentials remain restricted;
  never ask for or paste production credentials anywhere in the repository.

The wallet currently owns a separate `package.json`; npm workspaces and a single root
lockfile are planned in a separate migration phase. Do not commit generated
`wallet/package-lock.json`, `node_modules/` or build output.

## Repository layout (current)

| Path         | Responsibility                                                                     |
| ------------ | ---------------------------------------------------------------------------------- |
| `src/`       | Phaser 4 game client (TypeScript), pure logic under `src/logic/`                   |
| `bot/`       | Telegram bot Cloudflare Worker (plain ESM JavaScript), D1 migrations               |
| `wallet/`    | Polygon Amoy testnet Wallet Worker (plain ESM JavaScript), D1 migrations, runbooks |
| `shared/`    | Runtime-agnostic deterministic rules imported by both the game and the bot         |
| `tests/e2e/` | Playwright browser smoke and layout tests                                          |
| `assets/`    | Asset manifest, provenance and validation data                                     |
| `scripts/`   | Dependency-free repository checks used by CI                                       |
| `docs/`      | Architecture, ADRs, engineering standards, runbooks, phase baseline audit          |
| `.github/`   | Workflows, CODEOWNERS and the pull request template                                |

The target `apps/` + `packages/` monorepo layout is described in
[docs/architecture/README.md](docs/architecture/README.md). Do not move directories
outside an approved migration phase and its own reviewable PR.

## Set up

```sh
npm ci
npm run dev
```

Only when working on the wallet Worker:

```sh
cd wallet
npm install --no-audit --no-fund
npm run check
```

## Quality gates

Run every applicable gate before requesting review. Do not disable tests, relax
assertions or report a check as passed unless it was actually executed.

| Command                      | Covers                                             |
| ---------------------------- | -------------------------------------------------- |
| `npm run format:check`       | Prettier for game, docs and configuration files    |
| `npm run lint`               | Conservative ESLint gate                           |
| `npm run assets:check`       | Asset manifest, PNG dimensions and provenance      |
| `npm run docs:check`         | Documentation hygiene (LF endings, conflicts)      |
| `npm run typecheck`          | TypeScript strict, no emit                         |
| `npm test`                   | Vitest pure game-logic suite                       |
| `npm run test:bot`           | Bot regression suite (`node:test`)                 |
| `npm run build`              | Production bundle via `tsc --noEmit && vite build` |
| `cd wallet && npm run check` | Wallet syntax checks and `node:test` suite         |
| `npm run test:e2e`           | Playwright smoke/layout/analytics (browser setup)  |
| Wrangler `deploy --dry-run`  | Worker bundling for bot/wallet changes             |

Current PR workflows run different subsets behind path filters; they do not cover every
PR or every command above. In particular, assets/docs checks run in Pages after merge,
and bot Wrangler bundling has no PR gate. Run applicable checks locally and include exact
results in the PR. Phase 2 adds the always-running aggregate `required-ci` merge gate.

## Branches, commits and pull requests

- Work on a short-lived branch from the latest `main`, never directly on `main`.
- Use Conventional Commits and match the PR title to the commit convention, for example
  `fix(bot): reject duplicate callback ids`.
- Open one reviewable PR per concern. Do not mix workspace migration, formatting-only
  churn or unrelated bug fixes with behavior changes.
- Fill in `.github/pull_request_template.md`: summary, motivation, affected components,
  risk, test evidence, deployment impact, database impact, security, rollback.
- A human merges the PR. Agents and automation must never merge, force-push or rewrite
  shared history.

See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for details.

## Tests

- Pure game logic belongs in `src/logic/` with a Vitest test in `src/logic/__tests__/`.
- Bot tests use `node --test bot/tests/*.test.mjs`; wallet tests use `node:test` in
  `wallet/tests/`.
- Every bug fix needs a regression test. Scoring, leaderboard, authentication and wallet
  changes need tests for malformed and adversarial input in addition to happy paths.
- Wallet changes must preserve idempotency, nonce management, transaction
  reconciliation, audit trails and fail-closed authorization; cover those explicitly.
- Unit tests must be deterministic and offline. Use Playwright only for browser/runtime
  behavior.
- Never weaken or delete a failing test to make a PR green. If a failure is
  pre-existing, document it and fix it separately unless the current phase requires it.

## Documentation

- `README.md` describes **current** mechanics only; older release notes live in
  `CHANGELOG.md`.
- Architecture or cross-cutting decisions need an ADR in `docs/adr/` and an update to
  the relevant document in `docs/architecture/`.
- Operational changes need a runbook update in `docs/runbooks/` or the wallet runbooks.
- User-visible changes need a `CHANGELOG.md` entry.
- Verify technical claims against `package.json`, workflows and code. Do not copy stale
  version numbers forward.

## Security and wallet safety

- Never commit, log, paste or request secrets, private keys, API tokens,
  `.dev.vars`, Telegram identities or production data.
- Treat every client submission as untrusted. Do not remove server-side validation or
  claim prize-grade anti-cheat; see issue #6.
- Preserve the committed safe wallet defaults:
  `TRANSFERS_ENABLED=false`, `AUTO_REWARDS_ENABLED=false`, `MANUAL_REWARDS_ONLY=true`.
- Never change the Polygon Amoy chain ID (80002), the deployed contract address,
  treasury/distributor identities, signing keys, custody model or reward eligibility in
  this repository without a separately reviewed and explicitly authorized go-live PR.
- Never execute blockchain transactions, approvals or transfers in tests, CI or local
  verification.
- Keep GitHub Actions least-privilege and avoid interpolating untrusted input into
  `run:` scripts.
- Wallet-affecting changes require explicit human review and must state their rollback
  and reconciliation story.

## Review and merge

- CODEOWNERS lists the repository owner for sensitive paths. Code-owner review becomes
  mandatory when a second reviewer is available and the branch protection setting is
  enabled; see [docs/GOVERNANCE.md](docs/GOVERNANCE.md).
- Do not merge with failing required checks, unresolved review threads or unreviewed
  wallet/security changes.
- Deployments: GitHub Pages deploys on every `main` push; the Telegram bot deploys when
  `bot/**`, `shared/**` or its deployment workflow changes on `main` (also manual
  dispatch); the Wallet Worker is **manual dispatch only** and
  never deploys automatically. See [docs/runbooks/README.md](docs/runbooks/README.md).
- Roll back by reverting the PR. Never reset or force-push shared history.

## Baseline

The initial modernization audit, commit SHA, verification evidence and risk register
are recorded in
[docs/architecture/BASELINE_AUDIT_2026-10-22.md](docs/architecture/BASELINE_AUDIT_2026-10-22.md).
