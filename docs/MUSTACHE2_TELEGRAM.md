# Mustache2 on official Telegram Games

**Existing bot:** [@RJTtobot](https://t.me/RJTtobot)  
**Game 1:** `mustache` → https://mustache.alexa.ir/  
**Game 2:** `Mustache2` → https://mustache2.alexa.ir/  
**Shared webhook / D1:** `n5-mustache-rjttobot` at https://mustache.zedai.ir/telegram/webhook

This reuses the **same** bot, webhook, Cloudflare Worker and D1 database.
It does **not** introduce another bot, webhook or wallet, and it does not
mix the first game's score/XP/referral/reward logic with Mustache2.

## Mandatory manual BotFather registration (once)

Telegram does not offer a Bot API method for creating a game. In
[@BotFather](https://t.me/BotFather), use `/newgame`, select **@RJTtobot**,
and register a **second** game:

- Game title: `سیبیل ۲ — شکار سیبیل`
- Description: `سه شخصیت، یک خانه پر از مخفیگاه؛ رامین، برهان و ممد را قبل از پایان زمان پیدا کن!`
- Game short name: `Mustache2` (**exactly as registered in BotFather, capital M**)
- Game URL/domain if prompted: `https://mustache2.alexa.ir/`
- Upload a landscape PNG/JPG cover and accept the gaming terms.

The game short name in BotFather, the `MUSTACHE2_GAME_SHORT_NAME` Worker variable, `sendGame` and Telegram links must be identical, including letter case. The title **Mustache2** is not a substitute for checking the actual game short name.\n\nDo **not** edit/delete `mustache` or replace the existing Telegram webhook.

Once registered, the link is
**https://t.me/RJTtobot?game=Mustache2**.

## Deployment order

1. Merge this Worker PR. The existing
   `.github/workflows/deploy-cloudflare-worker.yml` deploys the Worker
   and applies `bot/migrations/0006_mustache2.sql` to the existing D1.
   Verify the Worker workflow passed and `https://mustache.zedai.ir/api/status`
   still responds successfully.
2. Create the Game in BotFather if it does not already exist.
3. Merge the companion frontend PR in `jaavid/mustache2` to deploy the
   static game via its existing GitHub Pages flow.
4. Send `/games`, `/play` and `/play2` to @RJTtobot.
   Both Telegram Game Cards must open their own separate domain.
5. Complete a Mustache2 round inside Telegram and check
   `GET https://mustache.zedai.ir/api/mustache2/leaderboard`.
   A regular web visit should remain playable without login and must
   **not** submit official Telegram Game Card scores.

No webhook rotation, second D1 UUID, new Telegram token, or additional
GitHub Secret is needed. The new variables are ordinary public `[vars]`
in `bot/wrangler.toml`.

## API / safeguards

- `POST /api/mustache2/round/start` — requires callback-issued Bearer session.
- `POST /api/mustache2/round/finish` — same session and round ID, one-time
  write to `mustache2_rounds`; retries cannot inflate score.
- `GET /api/mustache2/leaderboard` — public top-ten and count, with `me`
  only for an authenticated Mustache2 session.
- Telegram `setGameScore` updates the **Mustache2 card**; the first game
  uses its own Telegram cards and round tables.
- CORS permits only configured first-party game origins. A Mustache2 session
  is rejected by Mustache1's round, profile and personalized leaderboard APIs.

**Security limitation:** Browser-provided captures, score and duration have
sanity checks and idempotency, but not server-authoritative gameplay replay.
The Mustache2 board is **casual/unverified**. No prizes, tokens, wallet
allocations, or Mustache1 XP/leaderboard entries are issued from its scores.
