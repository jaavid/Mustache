# Official Telegram Game deployment — @RJTtobot

This is **Telegram Games API**, not Telegram Mini Apps. The existing static
frontend stays on GitHub Pages; Cloudflare Worker handles the bot webhook.
The bot is **not deployed or connected** merely by merging this PR.

## 1. Create the Game in @BotFather

1. Send `/newgame` to [@BotFather](https://t.me/BotFather).
2. Select the existing bot **@RJTtobot**.
3. Title: **N5 Mustache Mayhem**.
4. Description: **Catch Ramin in the forest and land your mustache precisely! 45 seconds, three stages, big combos.**
5. Upload a landscape gameplay cover PNG/JPG (optional animation is supported).
6. Short name: **mustache** (use the exact final short name in `bot/wrangler.toml`).
7. Agree to the Telegram gaming terms and complete any prompts.
8. If prompted to configure a game URL or game domain, use
   **https://mustache.alexa.ir/**. The Worker returns this exact HTTPS URL
   in `answerCallbackQuery`.

Game link after registration:
https://t.me/RJTtobot?game=mustache

To allow `@RJTtobot mustache` to insert Game Cards into chats, enable inline
mode via `/setinline` for **@RJTtobot**. Inline mode is optional.

Do not configure the **Main Mini App** for this purpose: `/newgame` creates the
official native **Game Card / Play** experience.

## 2. Automatic Cloudflare Worker deployment

The bot webhook runs on Cloudflare Workers, independently of GitHub Pages.
The workflow [deploy-cloudflare-worker.yml](../.github/workflows/deploy-cloudflare-worker.yml)
deploys the Worker **after a merge to `main` changes `bot/**` or the workflow**.
You can also run it from GitHub Actions using **Run workflow**.
Pull requests only run checks; they never deploy or receive production secrets.

Create a GitHub environment named **`production`** under **Settings >
Environments** (optional approval rules), then add these four encrypted
secrets to its Environment secrets. Repository-level Actions secrets are
also supported if the environment has no overrides.

| GitHub secret             | Value                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | Cloudflare API token authorized to deploy this Worker                     |
| `CLOUDFLARE_ACCOUNT_ID`   | Cloudflare account ID (not zone ID)                                       |
| `TELEGRAM_BOT_TOKEN`      | Standard BotFather HTTP API token for **@RJTtobot**                       |
| `TELEGRAM_WEBHOOK_SECRET` | Separate, random 32+ character secret; use `openssl rand -hex 32` locally |

Create the Cloudflare token under **Cloudflare > Account API tokens** and
scope it to the correct account. An existing Worker needs **Workers Editor**
access; creating a Worker for the first time requires product-level **Workers
Admin**. Prefer first creating the named Worker `n5-mustache-rjttobot` in
Cloudflare and granting the CI token access to just that Worker.

The production workflow:

1. Checks out the merged commit and runs the isolated bot syntax and unit tests.
2. Fails before deployment if any of the four secrets is missing.
3. Uses the official `cloudflare/wrangler-action@v4` from the `bot/`
   directory to deploy `bot/wrangler.toml`.
4. Writes `BOT_TOKEN` and `WEBHOOK_SECRET` into Cloudflare Worker **encrypted
   secrets**, directly from the two `TELEGRAM_*` GitHub secrets.
5. Reports the deployment URL in the GitHub Actions run.

The workflow does **not** commit credentials, deploy on pull requests, change
the GitHub Pages site, or run `setWebhook`. Do not paste credentials into
workflow logs or source files. Cloudflare secret updates can trigger Worker
releases, so changes to these secrets should go through the same controlled
production configuration.

## 3. One-time Telegram webhook registration

Once a **successful** deployment shows its public `https://...workers.dev`
URL, check if that Worker is reachable at `/health`. The webhook endpoint
is `/telegram/webhook`.

**IMPORTANT:** `setWebhook` replaces any existing webhook on **@RJTtobot**.
Check `getWebhookInfo` first and preserve any existing bot functionality.
If the bot has another webhook, integrate the game routes into that existing
backend rather than overwriting the webhook. A new Worker deployment does
not automatically change the active Telegram webhook.

Register the webhook just **once** after confirming it is safe to change:

```bash
read -rsp "Bot token: " BOT_TOKEN; echo
read -rsp "Webhook secret: " WEBHOOK_SECRET; echo
read -rp "Worker base URL: " WORKER_URL

curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
# Only proceed if the current webhook is empty or intentionally being replaced:
curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/telegram/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query","inline_query"]'

unset BOT_TOKEN WEBHOOK_SECRET
```

Use the **same** `TELEGRAM_WEBHOOK_SECRET` value configured in GitHub
(for the Worker secret). A subsequent merge will update Worker code and keep
the existing webhook URL, so no repeat registration is needed. When rotating
the webhook secret, coordinate an update to the Telegram `setWebhook` secret
to avoid breaking delivery.

The Worker only accepts POSTs to `/telegram/webhook` with the matching
`X-Telegram-Bot-Api-Secret-Token`; `/health` is public and contains no
sensitive data.

## 4. Play and check

- Open [@RJTtobot](https://t.me/RJTtobot) and send `/play`.
- Expect a native Game Card with **Play N5 Mustache Mayhem**.
- Tap Play, which triggers `game_short_name` and `answerCallbackQuery(url)`.
- Finish a round, tap **SHARE GAME** to use the Telegram gaming share dialog.
- Test the standalone web version; it must still use Web Share/clipboard.
- Optionally try inline mode by typing `@RJTtobot mustache` in another chat.

## 5. Scores and prizes: intentionally out of scope

Current `localStorage` scores are **practice-only**. No `setGameScore`,
`getGameHighScores`, wallet integration or prize issuance is enabled. Telegram
Game Cards work without server scores, but their **official chat leaderboard**
will remain empty until server-validated scoring is implemented.

Future work must authenticate game sessions using Telegram callback context,
capture or generate server-verifiable rounds and validate shots and timestamps
before posting server-approved scores with `setGameScore`. Do not accept an
arbitrary score from the browser or offer real N5 rewards yet.

Official documentation:

- https://core.telegram.org/bots/games
- https://core.telegram.org/bots/api#games
