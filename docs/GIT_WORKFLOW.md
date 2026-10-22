# Trunk-based development and commit conventions

This repository follows trunk-based development: `main` is the trunk, it must remain
deployable, and all changes reach it through short-lived branches and reviewed pull
requests. Production deployments are triggered from `main` (or by an explicitly
authorized manual dispatch for the Wallet Worker).

## 1. Branch from the latest `main`

```sh
git fetch origin
git switch main
git pull --ff-only
git switch -c fix/bot-duplicate-callback
```

- Never commit directly to `main`.
- Never force-push, rewrite shared history or rebase commits already reviewed on a
  shared branch.
- Keep branches short-lived. If `main` moved, merge `main` into your branch; do not
  rewrite the branch.
- Delete the branch after merge when GitHub confirms the PR is merged. Do not delete
  branches that another open PR still uses.

### Branch naming

Use `<type>/<short-kebab-slug>`, for example:

| Prefix      | Use for                                                  |
| ----------- | -------------------------------------------------------- |
| `feat/`     | New user-visible capability                              |
| `fix/`      | Bug or regression fix                                    |
| `chore/`    | Maintenance, governance, tooling without behavior change |
| `ci/`       | GitHub Actions, quality gates, deployment automation     |
| `refactor/` | Behavior-preserving code restructuring                   |
| `docs/`     | Documentation-only changes                               |
| `test/`     | Test-only changes                                        |
| `perf/`     | Measurable performance improvement                       |
| `security/` | Security hardening or vulnerability remediation          |
| `deps/`     | Dependency update (Dependabot uses its own prefixes)     |

Phase branches use the names recorded in
[docs/architecture/README.md](architecture/README.md).

## 2. Conventional Commits

Commit messages and PR titles use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short imperative summary>

[optional body explaining why and any compatibility notes]

[optional footer: BREAKING CHANGE: ..., Refs: #123]
```

Rules:

- `type` is one of `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `revert`, `security`.
- `scope` is optional but recommended when the area is clear: `game`, `bot`, `wallet`,
  `shared`, `ci`, `docs`, `governance`, `deps`, `release`.
- Summary is imperative, lowercase, no trailing period, ideally ≤ 72 characters.
- Body explains motivation, compatibility and any risk. Do not put secret values,
  tokens or personal data in commit messages.
- Breaking changes use `!` after the type/scope **and** a `BREAKING CHANGE:` footer.
  Breaking API, leaderboard or deployment behavior needs an ADR and a migration plan.
- Keep commits logically scoped. Do not mix formatting-only churn with behavior changes.
- Avoid merge-commit noise on the branch; small fixup commits are fine because the PR
  merge preserves the reviewed unit.

Examples:

```text
ci(quality): add aggregate required-ci gate
refactor(bot): extract Telegram update router from webhook entrypoint
fix(wallet): reject duplicate callback confirmation ids
docs(adr): record npm workspace decision
```

## 3. Pull request naming and description

- PR title mirrors the Conventional Commit form, for example
  `chore(governance): add CODEOWNERS, PR template and ADR process`.
- Fill in `.github/pull_request_template.md` completely. "None" is acceptable only when
  it is true for deployment, database and security impact.
- Include exact verification commands and results. Link the workflow run when available.
- State skipped checks and why. Never claim an unexecuted check passed.
- Keep one concern per PR. If you find an unrelated bug, report it separately instead of
  silently fixing it in the current PR.
- Mark the PR ready only when the branch is based on the latest `main`, tests are added
  and the description is complete.

## 4. Review and merge

- Required checks (Phase 2: the aggregate `required-ci` check) must pass before merge.
- Review the behavior, boundaries, tests, docs, deployment/database impact and secret
  handling described in the PR template, not just CI status.
- CODEOWNERS owns sensitive paths; when a second reviewer exists, code-owner review is
  required for wallet, bot, shared rules, CI and dependency changes (see
  [GOVERNANCE.md](GOVERNANCE.md)).
- A human merges. Agents and bots never merge PRs, approve their own changes or bypass
  protection.
- Current merge method: **merge commit** through the GitHub PR, preserving reviewed
  commits and linking the PR number in `main`. Do not rebase-merge or squash unless the
  PR owner and reviewer agree the history is not worth preserving.
- Do not merge with unresolved review conversations, failing required checks or pending
  environment approval.
- After merge, verify the deployment that the merge triggers (Pages, bot Worker, or none
  for wallet). The Wallet Worker is manual-only and must never auto-deploy.

### Outdated branches

If `main` changed while the PR was open:

```sh
git fetch origin
git switch my-branch
git merge origin/main
# resolve conflicts, run gates, push normally (no force push)
```

## 5. Release and versioning

- Version history and published tags are preserved; do not retag or rewrite release
  commits.
- The repository is currently versioned by `package.json` and `CHANGELOG.md`; formal
  release conventions, changelog generation and per-service release records are Phase 6.
- Game, Telegram bot and Wallet Worker release independently:
  - game: merge to `main` → Pages workflow;
  - bot: merge affecting `bot/**` or `shared/**` → Worker deployment workflow;
  - wallet: **manual dispatch only**, after explicit review, with transfers disabled.
- A merge is not authorization to enable wallet transfers or automatic rewards.

## 6. Emergency changes

Trunk-based flow still applies in an incident:

1. Create a `fix/` or `security/` branch from `main`.
2. Keep the change minimal and test the specific failure.
3. Open a PR with the incident context, risk, verification and rollback.
4. Request expedited human review; do not disable protection or force-push.
5. If repository settings must temporarily change, record who changed what and restore
   them immediately after the incident (see [GOVERNANCE.md](GOVERNANCE.md)).

## 7. Agent and automation rules

- Agents must never push to `main`, force-push, delete shared branches or merge PRs.
- Agents create branches/PRs, run verification and report evidence; a human reviews and
  merges.
- Automation may post status updates, but must not approve, sign or merge on behalf of a
  human.
- Never include credentials in branch names, commit messages, PR descriptions or logs.
