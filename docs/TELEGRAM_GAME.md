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

## 2. Deploy the webhook Worker

Cloudflare Workers is used instead of deploying another bot with the Telegram
Serverless CLI because the existing static game uses Telegram's _Games API_,
not Mini App Serverless endpoints.

Install or use Wrangler with your Cloudflare account:

```bash
cd bot
npx wrangler@4 login
npx wrangler@4 secret put BOT_TOKEN
npx wrangler@4 secret put WEBHOOK_SECRET
npx wrangler@4 deploy
```

- `BOT_TOKEN`: BotFather's standard **HTTP API token** for **@RJTtobot**.
- `WEBHOOK_SECRET`: a separate random 32+ character string. Generate it
  privately (e.g. `openssl rand -hex 32`). It is **not** the bot token.
- Never commit either token or paste them into issues, PRs or chat.
- Copy the actual `https://....workers.dev` URL printed by deployment.

**IMPORTANT:** `setWebhook` replaces any current webhook on **@RJTtobot**.
Check `getWebhookInfo` and back up existing handlers before changing it.
If this bot currently runs other features, merge their routing into this
Worker (or send the game callbacks through the existing bot backend) rather
than replacing the webhook.

Register the Worker endpoint through the Bot API:

```bash
# Work locally; do not print or log the real token/secret.
read -rsp "Bot token: " BOT_TOKEN; echo
read -rsp "Webhook secret: " WEBHOOK_SECRET; echo
read -rp "Worker base URL: " WORKER_URL

curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/telegram/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query","inline_query"]'

unset BOT_TOKEN WEBHOOK_SECRET
```

The worker only accepts POSTs to `/telegram/webhook` carrying
`X-Telegram-Bot-Api-Secret-Token`. Its public `/health` endpoint is safe.

## 3. Play and check

- Open [@RJTtobot](https://t.me/RJTtobot) and send `/play`.
- Expect a native Game Card with **Play N5 Mustache Mayhem**.
- Tap Play, which triggers `game_short_name` and `answerCallbackQuery(url)`.
- Finish a round, tap **SHARE GAME** to use the Telegram gaming share dialog.
- Test the standalone web version; it must still use Web Share/clipboard.
- Optionally try inline mode by typing `@RJTtobot mustache` in another chat.

## 4. Scores and prizes: intentionally out of scope

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
