# N5 Wallet deployment

GitHub owns Worker configuration and Service Bindings. GitHub Actions owns the shared internal service key and operator ID. Cloudflare Secrets owns custody credentials.

Never commit secrets, private keys, encryption keys, or `.dev.vars` files.

## One-time GitHub setup

Open [GitHub Actions secrets and variables](https://github.com/jaavid/Mustache/settings/secrets/actions).

Create one repository secret named `WALLET_SERVICE_KEY`. Use the existing internal key if it is available from your secure password manager. Otherwise, generate a new 32-byte random key with `openssl rand -hex 32` and update both Workers together.

Create one repository variable named `ADMIN_TELEGRAM_USER_ID`. Set it to the numeric ID returned by the private Telegram command `/myid`.

Verify that the GitHub environments `production` and `wallet-testnet` do not override these names with different values. Environment-level secrets can override repository-level secrets.

Keep the existing Cloudflare and Telegram deployment credentials, D1 IDs, and GitHub environment approvals.

## Git-tracked Service Binding

The bot's `bot/wrangler.toml` declares:

```toml
[[services]]
binding = "WALLET"
service = "n5-wallet-service-amoy"
```

The `WALLET` binding connects the bot Worker to the separate Wallet Worker. This name is not a password and belongs in source control.

Once the binding is active, `WALLET_API_URL` is unnecessary for these internal calls. Keeping its previous Cloudflare value does not override the Service Binding.

Both GitHub deployment workflows synchronize the same `WALLET_SERVICE_KEY` secret to their respective Workers. Both also inject `ADMIN_TELEGRAM_USER_ID` at deploy time without committing its value.

Both Wrangler configurations enable `keep_vars` to preserve Cloudflare-managed plaintext variables. Existing Worker Secrets survive normal Wrangler deployments independently of `keep_vars`.

## Deployment order

1. Configure the repository secret and variable before merging this change.
2. Merge after CI passes. The production Telegram Worker deploys automatically.
3. Run [Deploy N5 Wallet (Amoy manual)](../.github/workflows/deploy-wallet.yml) on `main`.
4. In Cloudflare, verify the bot has Service Binding `WALLET` pointing to `n5-wallet-service-amoy`.
5. In the private Telegram chat, run `/myid`, `/walletcheck`, `/wallet`, and `/admin`.
6. Confirm that existing wallet addresses are unchanged and new users can create their wallets automatically.

Missing shared credentials or operator configuration causes GitHub Actions to stop before deployment. No token transfer, withdrawal, or wallet rotation is part of this change.

## Security

Leave `TRANSFERS_ENABLED=false` and `AUTO_REWARDS_ENABLED=false` during rollout.

The Wallet encryption key, Distributor private key, Admin API token, and Amoy RPC URL remain in Cloudflare Secrets. Do not rotate the encryption key or replace the Wallet D1 database when repairing bot connectivity.

If the shared internal key is lost, rotate it by updating the GitHub repository secret and redeploying both Workers. Avoid posting any secret value in chat, GitHub issues, or CI logs.
