# Baseline audit — 2026-10-22

## Scope and method

- Repository: [jaavid/Mustache](https://github.com/jaavid/Mustache), public, default branch `main`.
- Baseline: `20f9d275ff3f2aefa032ec674924274420eb806b` (196 commits, no tags).
- Started from clean `main`; fetched/pruned and fast-forward pull confirmed it up to date.
- Phase 1 branch: `chore/repository-governance`. This report distinguishes baseline findings
  from governance changes applied during the audit.
- Reviewed tracked source/configuration, dependency manifests, six workflow files,
  GitHub repository settings, environments and recent workflow results. An independent
  read-only architecture review pinned its findings to the baseline commit; a separate
  review verified the Phase 1 documentation and live ruleset. A security audit subagent
  failed before its final report; its interim observations were not treated as a complete
  security assessment.
- No production deployment, remote migration, webhook update, transaction, signing,
  key rotation or database mutation was performed. Cloudflare account state and deployed
  runtime secrets were not inspected. This is not a penetration test or custody audit.

## Current system and dependencies

| Surface      | Implementation                                                                         | Deployment / data                                                                                                |
| ------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Game         | Root package; Phaser `^4.2.1`, TypeScript `~5.8.3`, Vite `^8.3.4`                      | GitHub Pages, https://mustache.alexa.ir/; `dist/`, relative Vite base                                            |
| Telegram bot | `bot/`, plain ESM JS, no separate package manifest                                     | Worker `n5-mustache-rjttobot`, https://mustache.zedai.ir/; D1 `n5-mustache-scores`                               |
| Wallet       | `wallet/`, separate package, viem `^2.40.0`, Wrangler `^4.45.0`, no committed lockfile | Manual-only Worker `n5-wallet-service-amoy`; D1 `n5-wallet-db`, scores D1 binding, `WalletSerial` Durable Object |
| Shared       | `shared/goldenRules.js`, `shared/modeRules.js`, handwritten `.d.ts`                    | Deterministic rules imported by game and bot, not an independent package                                         |

Root tooling includes Vitest `^5.0.4`, ESLint `^10.12.0`, Prettier `^3.9.10` and
Playwright `^1.64.0`; the root lockfile is v3. Audit host: Node `v22.21.1`, npm `11.14.1`.
Wallet-local Wrangler resolved to `4.151.3` during the audit, illustrating the unlocked install.

### Runtime and data coupling

- Game → bot: HTTPS DTOs and hostnames in `src/platform/competitiveScores.ts`.
- Bot → wallet: `WALLET` binding, shared-key authentication and server-derived Telegram
  identity; authenticated `WALLET_API_URL` HTTPS fallback also exists.
- Wallet → bot-owned D1: ranking, genesis and weekly reward planning. The binding grants
  read/write capability; current code uses it for reads, not a platform-enforced read-only role.
- The bot database UUID is injected from a secret; wallet deploy injects the scores UUID
  from a variable. Matching deployed identities is an operator verification obligation,
  not proven by this source review. Public committed UUIDs are identifiers, not credentials.
- Shared golden/Gold-Rush rules are single-source. Base aim geometry, combo/variant
  scoring and trace DTOs remain partly duplicated between client and server.
- No app-to-app private source imports were identified. A game-local layering leak exists:
  platform scoring imports `game/characterChoice`; dependency rules are not automated.

## CI/CD and governance baseline

Six tracked workflows exist:

| Workflow                       | Current behavior                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `pages.yml`                    | Every `main` push/manual dispatch: root checks, tests, build, Pages deploy                                      |
| `telegram-game-checks.yml`     | Path-filtered PR/manual checks; excludes shared-only changes and many root configs                              |
| `browser-smoke.yml`            | Selected game/package PR paths, weekly schedule, manual; Playwright artifacts                                   |
| `wallet-check.yml`             | Selected wallet/bot paths on PR/push/manual; unlocked wallet install, tests, local migration, dry-run           |
| `deploy-cloudflare-worker.yml` | `main` changes to `bot/**`, `shared/**` or itself/manual; remote D1 migrate, deploy, command sync, status probe |
| `deploy-wallet.yml`            | Manual dispatch only; tests, safe-flag assertions, remote wallet migration, deploy                              |

There is no stable aggregate PR check, reusable validation workflow or required check.
`shared/**`, many root configuration files and governance-only PRs can receive no PR CI.
Assets/docs checks run in Pages after merge, not the main PR validation workflow.
Bot/wallet/shared JS lack comprehensive lint/typecheck coverage. The docs checker covers
only five selected documents; formatting is not link validation.

At audit start there were no rulesets/classic protection, CODEOWNERS or PR template.
The sole verified collaborator/admin is `@jaavid`; no fictional organisation teams were
introduced. Approximately 49 remote branches and no open PRs were observed at baseline.
Six temporary workflow registry entries also remain despite absent YAML at HEAD; no
branches or registered workflows were deleted in this phase.

Repository security observations:

- Secret scanning and push protection enabled; Dependabot security updates enabled,
  zero open alerts at inspection. Root `npm audit` (including development dependencies)
  and `npm audit --omit=dev` reported zero vulnerabilities. This does not prove no secrets
  or vulnerabilities exist.
- Actions default token permissions are read-only and Actions cannot approve PR reviews.
  Allowed actions are unrestricted and actions/Wrangler use mutable major versions.
- `Production` and `wallet-testnet` had no required reviewers or deployment branch
  restriction. Manual dispatch is not independent environment approval.
- No LICENSE file or formal release tags were found. License selection is an owner/legal
  decision, not something an agent should invent.

## Executed baseline verification

| Command / check                     | Result                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`       | Passed                                                                                            |
| `npm run format:check`              | Passed on baseline                                                                                |
| `npm run lint`                      | Passed                                                                                            |
| `npm run assets:check`              | Passed; five source PNGs, 22 texture groups                                                       |
| `npm run docs:check`                | Passed (limited document set)                                                                     |
| `npm run typecheck`                 | Passed                                                                                            |
| `npm test`                          | Passed: 29 files, 109 tests (also rerun after Phase 1 edits)                                      |
| `npm run test:bot`                  | Passed: 123 tests (also rerun after Phase 1 edits)                                                |
| `npm run build`                     | Passed; existing approximately 1.48 MB minified chunk warning (>500 kB)                           |
| Wallet `npm run check`              | Passed: 40 tests after successful dependency installation                                         |
| Wallet Wrangler `deploy --dry-run`  | Passed; safe flags false / false / true                                                           |
| Bot Wrangler `deploy --dry-run`     | Passed using wallet-local Wrangler; service binding preserved                                     |
| `npm audit`, `npm audit --omit=dev` | Zero vulnerabilities reported                                                                     |
| `npm run test:e2e`                  | Could not launch: matching Chromium revision absent; all cases failed before browser startup      |
| `npx playwright install chromium`   | Failed with host `EPERM` creating Playwright cache lock; browser verification remains uncompleted |

Final Phase 1 verification repeated `npm run check`, `npm run test:bot`, both root
security audits, wallet checks and both Worker dry-run bundles successfully. The dry
runs exited 0 and produced bundles with unchanged bindings/safe flags, but Wrangler
could not write its optional home-directory logs (`EPERM`); this host warning is not a
clean logging verification. The build's existing chunk-size warning remains.

Wallet dependency installation initially failed on the host's npm cache permissions;
retry with `npm_config_cache=/tmp/npm-cache-javid npm install --no-package-lock --no-audit
--no-fund` succeeded. No wallet lockfile was added. These are host setup failures, not
established application regressions; neither was hidden by weakening assertions.
Recent successful main workflow evidence includes
[Pages 39774128530](https://github.com/jaavid/Mustache/actions/runs/39774128530),
[bot deploy 39605512827](https://github.com/jaavid/Mustache/actions/runs/39605512827),
[wallet checks 39605512839](https://github.com/jaavid/Mustache/actions/runs/39605512839),
and [manual wallet deploy 39605712606](https://github.com/jaavid/Mustache/actions/runs/39605712606).
These historical successes are not new deployments performed by this audit.

## Prioritized risk register

Severity describes potential impact, not proof of exploitation. Planned phases do not
imply a fix has shipped or authorize changing behavior.

| ID         | Severity | Finding / evidence                                                                                | Disposition                                                                                                                                      |
| ---------- | -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GOV-01     | High     | Unprotected `main` allowed direct pushes and history changes                                      | Phase 1 mitigated with active default-branch ruleset; PR, no force-push/delete, no bypass                                                        |
| GOV-02     | Medium   | No formal ownership, PR checklist, ADR or review process; stale Phaser 3/no-wallet claims         | Phase 1 adds ownership/process and corrects active docs                                                                                          |
| GOV-03     | Medium   | Sole maintainer cannot approve own PR; no independent reviewer                                    | Required approvals remain 0 intentionally; human review remains policy; add second reviewer before enforcing independent approvals               |
| CI-01      | High     | Shared-only/config/governance PRs can skip all CI; no required aggregate                          | Phase 2 always-running `required-ci`, then require it in ruleset                                                                                 |
| CI-02      | Medium   | Duplicated suites, uneven assets/docs/JS coverage; bot local Wrangler migration not PR-tested     | Phase 2 consolidate and expose accurate coverage                                                                                                 |
| CI-03      | Medium   | Mutable action tags/Wrangler versions; broad allowed-actions policy                               | Phase 2 evaluate SHA pinning and least privilege                                                                                                 |
| DEP-01     | High     | Wallet has no committed lockfile and workflows use `npm install`                                  | Phase 3 npm workspaces/single lockfile with reproducible CI                                                                                      |
| ARCH-01    | Medium   | Duplicate scoring math/DTOs and ranking/time-window logic; no cross-app contract tests            | Phase 4 pure rules/contracts and differential tests before extraction                                                                            |
| ARCH-02    | Medium   | Large scenes/routers/operator modules and unenforced dependency direction                         | Phase 5 behavior-preserving deep-module splits, test through interfaces                                                                          |
| SEC-01     | High     | Client supplies target position/variant and timing; arithmetic validation is not prize-grade      | [Issue #6](https://github.com/jaavid/Mustache/issues/6); keep real-value awards disabled; separate anti-cheat design, not solved by code sharing |
| SEC-02     | High     | Wallet signing/broadcast/journal lifecycle lacks direct end-to-end tests                          | Safe flags/manual authorization mitigate exposure; add isolated tests without signing real transactions before changing financial paths          |
| SEC-03     | Medium   | Production/wallet environments permit dispatch branches without independent reviewers             | Phase 1 documents gap and exact hardening steps; no false approval claims; owner-controlled settings rollout                                     |
| DATA-01    | High     | Wallet reads bot-owned schema; deployed UUID matching unverified; broad binding capability        | Preserve identities, verify matching UUIDs/schema before future migration; no database recreation                                                |
| OPS-01     | Medium   | Remote migrations precede deploy; no tested database restore/rollback runbook                     | Additive changes only; Phase 6 explicit recovery procedures; code revert cannot undo data migration                                              |
| OPS-02     | Medium   | Custodial encryption key and transaction journal need protected backup/restore and reconciliation | Existing wallet runbooks remain authoritative; never rotate key or blindly re-sign during modernization                                          |
| REL-01     | Medium   | No formal release/tag/observability process                                                       | Phase 6 release records, verification and incident runbooks                                                                                      |
| HYGIENE-01 | Low      | Stale branch/workflow registry entries; merged-branch deletion disabled                           | Owner-reviewed cleanup later; no deletion in Phase 1                                                                                             |
| LEGAL-01   | Medium   | Public repository without LICENSE                                                                 | Owner/legal decision; no license invented                                                                                                        |

## Positive controls and preserved constraints

- Existing game/bot/wallet test suites, shared deterministic rules and server arithmetic
  revalidation provide a useful behavioral baseline, not anti-cheat proof.
- Wallet design includes encrypted keys, serial signing coordination, transaction journal,
  reconciliation/idempotency logic and operator confirmation paths; test depth varies.
- Committed `TRANSFERS_ENABLED=false`, `AUTO_REWARDS_ENABLED=false`,
  `MANUAL_REWARDS_ONLY=true`; deploy workflow asserts them. Manual wallet deploy retained.
- Preserve chain `80002`, contract `0xb0762E4EB2a1c4e4c3d65b93048972aBB60dFaa7`,
  Worker names, D1 identities/migration history, `WalletSerial`, service bindings and domains.
- Preserve desktop 960×540 and portrait 540×960, impact-only scoring, exact-pointer landing,
  elliptical hitboxes, timing, progression, modes and leaderboard behavior.

## Phase 1 outcome and next gate

Phase 1 changes documents/ownership/template only; no application source, dependency
manifest/lockfile, workflow, Wrangler config or schema is changed. Repository settings
were separately updated: [ruleset 25639602](https://github.com/jaavid/Mustache/rules/25639602)
is active, has no bypass actors, requires PRs/resolved conversations and blocks deletion
and non-fast-forward updates. Required approvals remain zero and required checks absent;
these limitations are explicit in [Governance](../GOVERNANCE.md).

After human review and merge, Phase 2 may begin from updated `main`. Do not start workspace
migration, CI replacement, shared-code extraction or refactoring in this PR.
