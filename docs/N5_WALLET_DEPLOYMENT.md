# N5 Wallet — GitHub / Cloudflare deployment contract

Source of truth: GitHub for **Worker bindings and configuration**, GitHub Actions
for **the cross-Worker authentication credential** and operator identity, and
Cloudflare Worker Secrets for **wallet custody**. Do not commit API keys,
private keys, ciphertext passwords, tokens or `.dev.vars`.

## One-time setup (required BEFORE merging the PR)

In the existing repository
[Settings → Secrets and variables → Actions](https://github.com/jaavid/Mustache/settings/secrets/actions):

1. Under **Repository secrets**, create `WALLET_SERVICE_KEY` with the **same
   value** you previously configured on `n5-wallet-service-amoy`, if still
   available in your password manager. Cloudflare **does not show existing
   secret values**. If unavailable, generate a *new* random value locally
   with `openssl rand -hex 32`, keep it private, and plan a coordinated
   update of **both** Workers. Never use `ADMIN_API_TOKEN` or any wallet
   private key here.
2. Under **Repository variables**, create `ADMIN_TELEGRAM_USER_ID` with your
   numeric Telegram user ID (run `/myid` in a private Telegram chat to
   confirm). This value is not a secret; it is injected into the deployed
   config by GitHub Actions, not hardcoded into versioned source.
3. Confirm that `production` and `wallet-testnet` GitHub Environments do not
   override these names with different values. **Environment secrets take
   precedence over repository secrets.** Use ONE shared repository-level
   `WALLET_SERVICE_KEY` and ONE shared repository variable for both jobs.
4. Existing production bot secrets `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`, `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_D1_DATABASE_ID` must
   remain intact. Wallet environment requires the Cloudflare credentials and
   `N5_WALLET_D1_ID` / `N5_SCORES_D1_ID` variables.

## What is safe to commit?

In `bot/wrangler.toml`:

```toml
keep_vars = true

[[services]]
binding = "WALLET"
service = "n5-wallet-service-amoy"
```

This is the **nonsecret Worker name** and its binding, *not* a password. All
Wallet calls prefer `env.WALLET.fetch(...)`; there is no need for a
public `WALLET_API_URL` once the binding is active. The old URL may be left
in Cloudflare settings for fallback, but it is not the selected transport.

The production bot GitHub Action runs Wrangler with these **secret names**,
sourced from GitHub Actions: `BOT_TOKEN`, `WEBHOOK_SECRET`,
`WALLET_SERVICE_KEY`. The manual wallet Action sources
`WALLET_SERVICE_KEY` from the **same repository secret**, and both pipelines
inject `ADMIN_TELEGRAM_USER_ID` from the same repository variable at runtime.
Values never enter commits; GitHub Actions validates nonempty configuration
*before* starting a deployment.

`keep_vars = true` protects dashboard-only plaintext vars from removal by
future Wrangler deploys. Cloudflare documents that **existing Worker secrets
are not deleted by ordinary Wrangler deployments**, regardless of keep-vars;
the explicit Actions secret synchronization ensures the shared key is always
present and consistent even after credential rotation.

## Deployment / verification

After repository secret and variable are configured and PR tests pass:

1. Merge the PR to `main`. The existing `Deploy Telegram Game Worker`
   workflow will run and attach the `WALLET` Service Binding to the bot.
   If required GitHub config is missing, the workflow FAILS BEFORE DEPLOYMENT;
   the previously deployed Telegram bot is left running.
2. Manually trigger
   [Deploy N5 Wallet (Amoy manual)](../.github/workflows/deploy-wallet.yml)
   on **main**. It updates the Wallet Worker with the shared key and admin
   variable without changing its existing D1 tables or wallets.
3. In Cloudflare Worker `n5-mustache-rjttobot` → Settings → Bindings,
   confirm `WALLET` points to **`n5-wallet-service-amoy`**, not to the
   bot itself. Under Variables and Secrets, confirm the secret **name**
   `WALLET_SERVICE_KEY` exists (never display or share its value).
4. In your **private** Telegram chat, send `/myid`, then `/walletcheck`,
   then `/wallet`, and `/admin`. `/walletcheck` should say
   `Cloudflare Service Binding`, service key configured, internal D1 auth
   successful, and wallet found. Your pre-existing wallet must have the
   **same on-chain address** as before.
5. Leave `TRANSFERS_ENABLED=false` and `AUTO_REWARDS_ENABLED=false`.
   Creating/showing wallets consumes no gas, and no token reward is needed.

**Important:** Never change `WALLET_ENCRYPTION_KEY` or replace the existing
Wallet D1 database just to fix bot connectivity. Wallet custody keys and
`DISTRIBUTOR_PRIVATE_KEY` remain in Cloudflare Secrets and are not managed
by these GitHub workflows. Back them up securely using approved key management
procedures. No private key is required to configure a Service Binding.
