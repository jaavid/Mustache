# Telegram scores and weekly rankings

Mustache has two independent score surfaces:

- **Cloudflare D1:** a Monday 00:00 UTC to Monday 00:00 UTC weekly top-ten,
  keeping each player's best score during that period.
- **Telegram Games API:** `setGameScore` updates the **all-time** high score
  attached to the original Game Card or inline game message. Telegram's built-in
  high score does **not** reset each week. No `force` flag is used.

The static game still keeps its local personal best. Browser-only visitors
can read the public weekly rankings but **cannot** submit a score without a
Telegram-issued session.

## One-time production setup

1. In your Cloudflare account, create a D1 database:

   ```sh
   npx wrangler@4 d1 create n5-mustache-scores
   ```

2. Copy the database UUID returned by Cloudflare into the GitHub **production**
   Environment Secret named `CLOUDFLARE_D1_DATABASE_ID` (or repository Actions
   secrets). Do **not** use the zone ID or account ID. The committed
   `bot/wrangler.toml` contains only a zero UUID placeholder; the workflow
   substitutes the real database UUID during deployment without committing it.

3. Ensure the existing `CLOUDFLARE_API_TOKEN` has the appropriate **D1
   Edit** permission in addition to its existing Workers deployment permission.

4. Merge the PR. The existing
   `.github/workflows/deploy-cloudflare-worker.yml` workflow will run bot
   tests, substitute the D1 UUID, apply `bot/migrations/*.sql` using
   `wrangler d1 migrations apply DB --remote`, and only then deploy the Worker.

5. Verify `https://mustache.zedai.ir/health` returns `ok`, then launch
   `https://t.me/RJTtobot?game=mustache`. If the Telegram webhook is already
   installed at `https://mustache.zedai.ir/telegram/webhook`, do not call
   `setWebhook` again. New Worker releases preserve that address.

6. Finish a full 45-second round. The results screen shows whether the D1
   score was saved and whether Telegram was also updated. Tap the missions/
   score line to open the weekly top-ten overlay.

**Do not merge until the D1 database has been created and the fifth GitHub
Secret is configured.** Deployment fails safely with a clear missing-secret
error rather than publishing a Worker with no database binding.

## Trust model and anti-cheat boundaries

1. Telegram's signed webhook delivers a `CallbackQuery` containing the user
   and the Game Card context. The Worker creates a random 256-bit game
   session, stores its SHA-256 digest in D1 and appends the short-lived bearer
   token to the game URL returned by `answerCallbackQuery`.
2. The game removes the token from browser history. Score API requests send it
   via `Authorization`; browser requests are CORS-restricted to the deployed
   game origin. Session tokens expire after one hour.
3. A separate D1 round ID is issued at the beginning of each scene. Rounds
   must run for at least 35 seconds and finish within 3 minutes.
4. The client sends every shot's impact coordinates, target lip coordinates,
   target variant, timing and combo. The server recomputes the same ellipse,
   combo and variant bonuses, rejecting impossible numeric values, timestamps,
   out-of-range coordinates, excessive shot counts and mismatched totals.
5. D1 stores the result **once**; retries cannot overwrite a stored round.
   The server may then use the callback's Telegram user ID and Game Card
   message identifiers for `setGameScore`. Client-supplied Telegram user IDs
   and chat IDs are never accepted in the score API.

**Critical limitation:** The animation and target position remain
client-controlled. A modified browser can fabricate a plausible trace.
Recalculation verifies arithmetic and authenticity of the Telegram session,
**not proof of human play**. Consequently these scores are suitable for a
casual leaderboard but are **not prize-grade verification**. N5 token awards,
wallet payouts or other valuable prizes must remain disabled until target
timelines are server-generated and shot replay is server-verifiable, with
additional abuse controls.

## Diagnostics

- HTTP `401` from `/api/round/start`: session missing/expired; relaunch
  from the **Telegram Game Card**, not the raw website.
- HTTP `503`: D1 binding missing on the Worker; verify workflow output.
- HTTP `400` from `/api/round/finish`: score/trace/timing validation failed.
- Score saved in D1 but Telegram was not updated: Game Card may already have a
  higher score or Telegram may have returned an error; the D1 weekly ranking
  still reflects the round.
- The weekly leaderboard uses UTC by design; Sunday/Monday boundaries may
  differ from your local timezone.
- Direct game site visitors remain in local practice mode, even if they can
  read the public leaderboard.

No Telegram Bot Token, API Token, session token or webhook secret should appear
in logs, database records or source code.
