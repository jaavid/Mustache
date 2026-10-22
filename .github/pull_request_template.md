<!--
Use Conventional Commits for the PR title, e.g. "chore(governance): add ADR process".
Keep one concern per PR. Never include credentials, private keys, tokens, Telegram
identities or production data in this description, screenshots or logs.
-->

## Summary

<!-- What does this PR change, and how? Keep it short. -->

## Motivation

<!-- Why is this change needed? Link the phase, issue or ADR. -->

## Affected components

- [ ] Game client (`src/`, `assets/`, GitHub Pages)
- [ ] Telegram bot Worker (`bot/`)
- [ ] Wallet Worker (`wallet/`)
- [ ] Shared rules / contracts (`shared/`, `src/logic/`)
- [ ] CI/CD, deployment or repository automation (`.github/`)
- [ ] Documentation, governance or tooling (`docs/`, root Markdown, `scripts/`)

## Risk assessment

- Behavior change: <!-- none / gameplay / scoring / API / deployment / wallet -->
- Blast radius: <!-- local / single deployable / multiple deployables / production data -->
- Reversibility: <!-- revert PR / redeploy previous commit / manual reconciliation needed -->

## Test evidence

List the exact commands you ran and their results. Link any workflow run. Never paste
secret values or unredacted production data. Do not mark a check as passing unless it
was actually executed.

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run assets:check`
- [ ] `npm run docs:check`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:bot`
- [ ] `npm run build`
- [ ] `cd wallet && npm run check` (when the wallet is affected)
- [ ] Wrangler dry-run bundle (when a Worker is affected)
- [ ] Playwright browser smoke (when runtime, layout or analytics is affected)
- [ ] Not applicable checks: <!-- explain why, or "none" -->

## Deployment impact

<!-- Which deployables change? Does this merge trigger Pages/Bot deployment?
     Does the Wallet Worker require a separate manual dispatch?
     Preserve existing domains, service bindings and deployment identities. -->

## Database impact

<!-- D1 databases and migrations touched, backward/forward compatibility,
     rollback story, whether migrations are additive. Write "none" if unchanged. -->

## Security implications

<!-- Auth/session/webhook changes, untrusted input, secrets handling, logging,
     wallet signing/custody/rewards, dependency risk. Write "none" only if true. -->

- [ ] No secrets, keys or production credentials added, logged or committed.
- [ ] Client input remains untrusted; server-side validation was not weakened.
- [ ] Wallet safety defaults are unchanged (`TRANSFERS_ENABLED=false`,
      `AUTO_REWARDS_ENABLED=false`, `MANUAL_REWARDS_ONLY=true`) unless a separately
      reviewed and explicitly authorized go-live PR says otherwise.
- [ ] No blockchain transaction, token approval, signature or transfer is executed by
      this change, its tests or its CI.

## Rollback procedure

<!-- How to undo safely. Revert the PR instead of rewriting history.
     For migrations or deployments, state the exact safe recovery steps. -->

## Checklist

- [ ] Branch is based on the latest `main`; no direct push to `main`.
- [ ] Conventional Commits are used and the PR title follows the same convention.
- [ ] Tests were added or updated with the change.
- [ ] Documentation, ADRs and runbooks were updated where affected.
- [ ] No unrelated formatting or drive-by behavior changes.
- [ ] This PR will be merged by a human after review; I will not merge it myself.
