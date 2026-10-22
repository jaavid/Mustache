# Runbook index

Operational procedures are kept close to the component they operate. `docs/runbooks/`
is the index and the future home of cross-cutting incident/rollback runbooks (Phase 6).
Do not move the existing wallet runbooks until a dedicated documentation PR; their paths
are linked from code, README files and incident notes.

## Wallet and testnet rewards

- [Wallet service overview](../../wallet/README.md) — architecture, API, custody model,
  deployment order, safety flags and incident handling.
- [Distribution runbook](../../wallet/DISTRIBUTION_RUNBOOK.md) — welcome and weekly testnet
  campaigns, preflight, approvals, verification, notification behavior.
- [Admin payout runbook](../../wallet/ADMIN_PAYOUT_RUNBOOK.md) — guided `/admin`
  distribution flow, pilot gating, pause/resume, confirmation tickets.
- [Auto-provisioning and Telegram](../../wallet/AUTO_PROVISION_AND_TELEGRAM.md) — wallet
  creation lifecycle, Telegram UI and troubleshooting.
- [Wallet deployment](../N5_WALLET_DEPLOYMENT.md) — GitHub secrets/variables, service
  binding, deployment order and security expectations.

## Telegram bot and scores

- [Telegram Game deployment](../TELEGRAM_GAME.md) — BotFather setup, webhook, secrets,
  deployment verification.
- [Telegram scores and D1](../TELEGRAM_SCORES.md) — API, D1 schema/migrations, Tehran
  competition windows, troubleshooting.
- [Player progression](../PLAYER_PROGRESSION.md) — XP, referrals, Gold Rush.
- [Gameplay telemetry](../GAMEPLAY_TELEMETRY.md) — verified-round metrics.

## Game client and analytics

- [Analytics](../ANALYTICS.md) — Umami setup, privacy boundary, event dictionary, release
  checks.
- [Phaser 4 migration](../PHASER4_MIGRATION.md) — renderer compatibility checklist.
- [Phaser 4 FX performance](../PHASER4_FX_PERFORMANCE.md) — quality budgets.
- [Golden Mustache](../GOLDEN_MUSTACHE.md) — integrity rules and anti-cheat limitation.

## Deployment quick reference

| Surface                 | How to deploy                                    | Verification                                                |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Game (GitHub Pages)     | Merge to `main` → `pages.yml`                    | Open https://mustache.alexa.ir/ after the workflow succeeds |
| Telegram bot Worker     | Merge `bot/**`/`shared/**` to `main`             | `GET /api/status` on `mustache.zedai.ir` and workers.dev    |
| Wallet Worker (testnet) | Manual `Deploy N5 Wallet (Amoy manual)` dispatch | `/health`, then `/admin/preflight`; no transfers by default |

## Safety rules for every operator action

- Never paste API credentials, private keys, encryption keys or Telegram identities into
  a terminal history, PR, issue, chat or log.
- Never run local production migrations. Remote migrations only through the established
  deployment workflows, after review.
- Never rotate `WALLET_ENCRYPTION_KEY`, recreate wallet D1 databases or change signing
  keys without a separately authorized plan and backup verification.
- Keep `TRANSFERS_ENABLED=false` and `AUTO_REWARDS_ENABLED=false` unless a separately
  reviewed go-live change explicitly authorizes test transfers.
- On uncertainty, stop and inspect state (D1 records, Polygonscan) instead of retrying
  or re-signing transactions.

## Rollback and incident response

Phase 6 will add explicit incident-response, deployment-verification and rollback
runbooks. Until then:

1. Stop the affected automation (do not dispatch or deploy further).
2. Record the deployed commit SHA from the workflow run's commit metadata (or summary
   when present).
3. For code regressions, revert the offending PR through a new reviewed PR. Never reset
   or force-push `main`.
4. For Wallet Worker incidents, keep transfers disabled; reconcile transaction state
   from D1 and Polygonscan before any further operation. Chain transactions already
   broadcast cannot be un-sent.
5. Never "fix" an incident by enabling transfers, rotating keys or deleting D1 records.
