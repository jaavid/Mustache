# Governance, ownership and branch protection

This document records how changes are owned, reviewed, merged and deployed. It is the
authoritative policy for contributors and coding agents. Update it in the same PR as any
governance change.

**Status:** Phase 1 baseline, verified 2026-10-22 against `jaavid/Mustache`
(`main` = `20f9d275ff3f2aefa032ec674924274420eb806b`).

## 1. Ownership

| Area                                                           | Owner                                                |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| Repository, `main` branch, production deployments and settings | `@jaavid` (admin)                                    |
| CODEOWNERS default owner                                       | `@jaavid`                                            |
| Wallet custody, signing keys, reward authorization             | `@jaavid` (explicit human go-live approval required) |
| Agents and automation                                          | No merge, approval, deployment or signing authority  |

CODEOWNERS lives at [`.github/CODEOWNERS`](../.github/CODEOWNERS) and lists the
repository owner for all sensitive paths: `.github/`, `bot/`, `wallet/`, `shared/`,
`src/logic/`, dependency pins, Wrangler configs, ADRs, governance and runbooks.

Only verified GitHub users or existing organisation teams may be added to CODEOWNERS.
Do not invent team handles. As of this phase there is exactly one collaborator and no
organisation, so the only valid owner is `@jaavid`.

CODEOWNERS by itself only requests reviews. Code-owner approval becomes a merge
requirement only when the ruleset setting **Require review from Code Owners** is enabled;
see §3 for why it is intentionally off while there is a single maintainer.

## 2. Current main-branch protection (applied)

A repository ruleset, not classic branch protection, protects the default branch:

| Setting                                          | Value                                                        |
| ------------------------------------------------ | ------------------------------------------------------------ |
| Ruleset name / id                                | `main-protection` / `25639602`                               |
| Target / enforcement                             | default branch / **active**                                  |
| Bypass actors                                    | **none** (even administrators cannot bypass)                 |
| Require a pull request before merging            | **yes**                                                      |
| Required approving reviews                       | **0** (temporary single-maintainer setting)                  |
| Require review thread resolution                 | yes                                                          |
| Require review from Code Owners                  | no (single maintainer; see §3)                               |
| Require extra approval for unattributed changes  | no (would deadlock a solo maintainer)                        |
| Allow force pushes                               | **no** (`non_fast_forward` blocked)                          |
| Allow branch deletion                            | **no** (`deletion` blocked)                                  |
| Allowed merge methods                            | merge commit and squash (rebase merge blocked)               |
| Required status checks                           | **not yet** — Phase 2 adds the aggregate `required-ci` check |
| Require branches to be up to date before merging | not yet — evaluate after Phase 2 stabilizes                  |

Verified state:

```console
$ gh api repos/jaavid/Mustache/branches/main --jq '{protected,protection}'
{"protected":true,"protection":{"enabled":false,"required_status_checks":{"checks":[],"contexts":[],"enforcement_level":"off"}}}
$ gh api repos/jaavid/Mustache/rules/branches/main --jq '.[].type'
deletion
non_fast_forward
pull_request
```

`protection.enabled:false` above is expected: the legacy branch-protection API is
unused; the active ruleset is the source of truth. Classic protection is **not** enabled.

### Why there are no required approvals yet

GitHub does not allow a user to approve their own pull request. With one maintainer,
requiring one approval would make every PR unmergeable — exactly the deadlock this phase
must not introduce. The compensating controls are:

- a pull request is still mandatory and force-push/delete is blocked;
- CI checks must be run and evidenced in the PR;
- wallet, security and deployment changes require explicit human go-live review;
- when a second trusted reviewer is available, raise the approval count and enable
  code-owner review immediately (instructions in §9).

## 3. Review policy

- Every change is reviewed by a **human** before merge. Agent-authored PRs receive the
  same review as human-authored ones.
- Reviewer focus: behavior preservation, deployable boundaries, trust boundaries,
  tests, secret handling, deployment/database impact and rollback.
- The reviewer must be independent from the author when a second reviewer exists.
- Do not merge while review conversations are unresolved, required checks fail or an
  environment approval is pending.
- Sensitive changes need explicit review notes in the PR and should be reviewed by
  someone other than the author whenever possible:
  - wallet custody, signing, transactions, payout/reconciliation, reward flags;
  - D1 schema or data changes;
  - GitHub Actions, secrets, deployment configuration or branch protection;
  - shared scoring/leaderboard/eligibility semantics;
  - production contract address, chain ID or domains;
  - dependency changes touching build, auth, crypto or wallet code.
- Never merge a PR to "unblock" a failing wallet or security check. Fix the check or
  document a reviewed exception.

## 4. CI quality gates

Current PR validation is split across path-filtered workflows:

| Workflow                                                         | Pull-request trigger                                          | Key jobs                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `telegram-game-checks.yml`                                       | selected game/bot/docs/README/package paths (not `shared/**`) | format, lint, typecheck, unit, bot, build                     |
| `wallet-check.yml`                                               | `wallet/**`, wallet-related bot files and the workflow file   | wallet check, bot tests, D1 local migration, Wrangler dry-run |
| `browser-smoke.yml`                                              | selected game/asset/package paths, weekly schedule            | Playwright smoke and screenshots                              |
| `pages.yml`, `deploy-cloudflare-worker.yml`, `deploy-wallet.yml` | push to `main` or manual dispatch only                        | deployment (never from PRs)                                   |

Known gap (Phase 2): because of path filters, a shared-rules-only, documentation-only or governance-only
pull request may run **no** PR workflow at all, and there is no single stable required
check. Phase 2 introduces an always-running `ci.yml` with one aggregate check named
`required-ci`, conditional expensive jobs and no duplicate test execution. Once that
check exists and is stable, add it to the ruleset as a required status check; a skipped
workflow must never leave a required check pending forever.

## 5. Deployment governance

| Surface                 | Trigger today                                                                  | Approval today                                     |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| GitHub Pages (game)     | push to `main` or `workflow_dispatch`                                          | none beyond reviewed merge                         |
| Telegram bot Worker     | push to `main` affecting `bot/**`/`shared/**`/deployment workflow, or dispatch | none beyond reviewed merge                         |
| Wallet Worker (testnet) | **manual `workflow_dispatch` only**                                            | manual dispatch; committed flags enforce safe mode |
| Telegram webhook        | one-time manual operation outside CI                                           | explicit human action, never automated             |

Rules:

- Production deploys only from `main` or an explicitly authorized manual dispatch.
- PRs never receive production secrets and never deploy.
- The Wallet Worker must never auto-deploy on merge. Its deploy workflow applies
  reviewed D1 migrations, asserts `TRANSFERS_ENABLED=false`,
  `AUTO_REWARDS_ENABLED=false`, `MANUAL_REWARDS_ONLY=true`, then deploys.
- Enabling test transfers, automatic rewards, changing signing/custody, rotating keys or
  changing the contract/chain is a separate financial go-live change requiring explicit
  human authorization — never a side effect of a refactor or repository modernization.
- Record the deployed commit SHA from the workflow run's commit metadata (or summary
  when present); deployment logs and
  health endpoints are the verification evidence. Phase 6 adds formal release records.

### Environment protection (current gap, manual hardening)

| Environment      | Protection rules today      | Recommendation                                                                                          |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `github-pages`   | Pages-managed branch policy | leave managed by Actions                                                                                |
| `Production`     | none                        | restrict deployment branches to `main`; add required reviewer when a second trusted maintainer exists   |
| `wallet-testnet` | none                        | restrict deployment branches to `main`; add a required reviewer when a second trusted maintainer exists |

Manual hardening steps (owner action; not applied in Phase 1 to avoid blocking the sole
maintainer). In **Settings → Environments → `<environment>`**:

1. **Deployment branches and tags** → _Selected branches_ → add `main`.
2. **Required reviewers** → add a trusted second reviewer when available. For an
   independent approval, also enable **Prevent self-review**. With that option enabled,
   making the sole maintainer the only reviewer would block their own deployments.
3. Keep repository/Cloudflare secrets as the source of truth; never store wallet signing
   or encryption keys in GitHub environments.

Equivalent API calls are documented in §9. Until a second reviewer exists, the manual
dispatch requirement, committed safe flags and the deployment workflow assertions are the
compensating controls.

## 6. Repository settings and security features

Verified 2026-10-22:

- Public repository, default branch `main`; merge commit, squash and rebase are enabled
  at repository level, but the ruleset restricts merges to merge commit and squash.
- `delete_branch_on_merge` is **false**; merge-created remote branches remain. Delete
  merged branches manually when safe.
- Secret scanning and secret scanning push protection: **enabled**.
  Secret scanning non-provider patterns and validity checks: disabled (recommend
  enabling in repository security settings).
- Dependabot security updates: enabled. No open Dependabot alerts at baseline.
- GitHub Actions default `GITHUB_TOKEN` permissions: **read**; workflows cannot approve
  PR reviews (`can_approve_pull_request_reviews=false`).
- Allowed GitHub Actions: all; third-party actions are used by mutable major tag, not by
  commit SHA. Phase 2 should evaluate SHA pinning for third-party actions.
- Environments: `github-pages`, `Production`, `wallet-testnet`.
- No branch rules other than `main-protection`; no required status checks configured yet.

## 7. Secrets policy

- Never expose, log, commit, rotate or invent production credentials. This includes
  Cloudflare API tokens, Telegram bot tokens and webhook secrets, `WALLET_SERVICE_KEY`,
  `WALLET_ENCRYPTION_KEY`, `DISTRIBUTOR_PRIVATE_KEY`, `ADMIN_API_TOKEN` and
  `AMOY_RPC_URL`.
- D1 UUIDs, account IDs, Worker names and public addresses are resource identifiers,
  not authentication credentials. Preserve existing binding identities; do not classify
  committed UUIDs as leaked secrets. Follow the established configuration storage.
- GitHub Actions holds deployment credentials as repository secrets/variables;
  Cloudflare holds Worker runtime secrets. Values must never be copied into the
  repository, PRs, issues, chat or logs.
- Rotating a key requires explicit human authorization, coordinated updates of both
  Workers where relevant, and verification. Never rotate the wallet encryption key or
  recreate wallet D1 databases as part of a deployment repair.
- Agents and CI must not print environment variables that may contain secrets.

## 8. Merge and release authority

- Only a human maintainer merges. Agents may open PRs and report verification only.
- Allowed merges: **merge commit** (default, preserves reviewed commits) or **squash**
  for a single coherent change. Rebase merge is blocked by the ruleset.
- Merging is not authorization to deploy the Wallet Worker, enable transfers or change
  reward configuration.
- Branch deletion after merge: manual until `delete_branch_on_merge` is intentionally
  enabled; never delete branches with open PRs or unmerged work.

## 9. Exact configuration instructions and rollback

### Create/repair the main ruleset (admin, `gh` CLI)

```sh
cat > /tmp/main-protection-ruleset.json <<'JSON'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "require_extra_approval_for_unattributed_changes": false,
        "allowed_merge_methods": ["merge", "squash"]
      }
    }
  ]
}
JSON
# Update the verified existing ruleset; POST would create a second ruleset.
gh api --method PUT repos/jaavid/Mustache/rulesets/25639602 --input /tmp/main-protection-ruleset.json
# Only if no ruleset exists: POST to /repos/jaavid/Mustache/rulesets instead,
# then record the returned ID here and use that ID for future updates.
```

Verify:

```sh
gh api repos/jaavid/Mustache/rules/branches/main --jq '.[].type'
gh api repos/jaavid/Mustache/rulesets --jq '.[] | {id,name,enforcement}'
```

Rollback (removes protection entirely; only for a verified emergency):

```sh
gh api --method DELETE repos/jaavid/Mustache/rulesets/25639602
```

### Add the aggregate required CI check (after Phase 2 creates `required-ci`)

Update the existing ruleset by appending:

```json
{
  "type": "required_status_checks",
  "parameters": {
    "required_status_checks": [{ "context": "required-ci" }],
    "strict_required_status_checks_policy": false,
    "do_not_enforce_on_create": false
  }
}
```

Enable `strict_required_status_checks_policy` only after the check proves reliable; it
requires branches to be up to date before merging and can add review latency.

### Enable independent review (when a second trusted reviewer joins)

1. Add the second verified GitHub user (or existing organisation team) to
   `.github/CODEOWNERS` for the relevant paths. Never invent team handles.
2. Update the ruleset's pull-request parameters:
   `required_approving_review_count: 1`, `require_code_owner_review: true`,
   `dismiss_stale_reviews_on_push: true`, keep
   `require_extra_approval_for_unattributed_changes: false`.
3. Do not enable required reviews while there is only one maintainer: self-approval is
   impossible and every PR would be blocked.
4. Document the change in this file's change log.

### Environment hardening

**Settings → Environments → `wallet-testnet`** (repeat for `Production`):

1. _Deployment branches and tags_ → _Selected branches_ → add `main`.
2. _Required reviewers_ → add a trusted second reviewer when available and enable
   _Prevent self-review_ for independent approval. GitHub only forbids the initiator's
   approval when that option is enabled; do not combine it with the sole maintainer as
   the only reviewer.
3. Save and confirm with a non-production dispatch before relying on it.

Branch-restriction API example (requires admin; configure reviewers separately in the UI):

```sh
# Enable custom branch policies first; preserve any existing environment settings.
gh api --method PUT \
  repos/jaavid/Mustache/environments/wallet-testnet \
  --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON

# Then allow main (repeat for Production).
gh api --method POST \
  repos/jaavid/Mustache/environments/wallet-testnet/deployment-branch-policies \
  -f name='main' -f type='branch'

# List current branch policies
gh api repos/jaavid/Mustache/environments/wallet-testnet/deployment-branch-policies
```

### Repository settings recommendations

- Enable **Settings → Code security → Secret scanning → non-provider patterns** and
  validity checks where available.
- Consider enabling automatic deletion of merged branches (`delete_branch_on_merge`).
- Phase 2: pin third-party actions to commit SHAs and restrict allowed actions if the
  workflow set stabilizes.

## 10. Exceptions and emergencies

- Exceptions must be documented in the PR and, if they change policy, in this document's
  change log. They are time-bounded and reviewed afterwards.
- In an incident, follow [docs/GIT_WORKFLOW.md](GIT_WORKFLOW.md) §6: branch, minimal fix,
  tests, PR, expedited human review. Do not disable protections, force-push or merge
  without a PR.
- If the ruleset must be temporarily changed, record who changed it, why and when it was
  restored. Never use the bypass as a permanent workflow.
- Wallet incidents: keep transfers disabled, reconcile from D1 and Polygonscan, and never
  "fix" by rotating keys, recreating databases or re-signing transactions blindly.

## 11. Change log

| Date       | Change                                                                                                                                                                                                                                             | Reference  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-10-22 | Introduced `main-protection` ruleset (PR required, no force-push, no deletion, no bypass). CODEOWNERS, PR template and governance policy added. Required CI check deferred to Phase 2; required approvals deferred until a second reviewer exists. | Phase 1 PR |
