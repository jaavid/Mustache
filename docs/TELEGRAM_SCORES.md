# Telegram scores and Tehran contest leaderboards

**Competition timezone:** IANA Asia/Tehran. **Weekly reset:** Saturday 00:00
Tehran up to (but not including) the next Saturday 00:00 Tehran.
For example, the week starting Saturday **2026-10-10 00:00 Tehran** begins
Friday **2026-10-09 20:30 UTC**, and ends at **2026-10-17 00:00 Tehran**.

The database's original "Monday UTC" week_start values are preserved for
historical records. **All rankings now use finished_at**, so previously recorded
scores are correctly placed into Tehran contest windows without overwriting data.

## Competition periods

| Tab     | Time window                                         | Ranking rule                |
| ------- | --------------------------------------------------- | --------------------------- |
| DAY     | Calendar day, midnight-to-midnight Tehran           | Each player's best round    |
| WEEK    | Saturday 00:00 until next Saturday 00:00 Tehran     | Each player's best round    |
| MONTH   | **Persian (Solar Hijri) calendar month**, Tehran    | Each player's best round    |
| ALL     | Entire game history                                 | Each player's best round    |
| TG CHAT | Telegram Game Card scoreboard; chat-local, all-time | Native Telegram high scores |

The weekly leaderboard supports browsing the preceding 12 completed
Saturday-to-Saturday periods. Each D1 leaderboard includes the top ten,
number of participating players, the signed-in player's own rank even when
outside the top ten, the local time window and approximate time remaining.
Empty archived periods remain empty and do not use scores from adjacent weeks.

## End-of-round behavior

1. A player starts the game through the native
   https://t.me/RJTtobot?game=mustache Game Card. Telegram sends a Game
   Callback; the Worker generates an expiring session tied to the user and
   Game Card or inline message and opens the Phaser game.
2. The game opens an authenticated D1 round and sends its impact trace at
   the end. The Worker validates and stores the **exact accepted score once**.
3. The Worker calls Telegram \`setGameScore\` with
   \`disable_edit_message=false\`, so a **new personal high** edits the
   original Telegram Game Card to display Telegram's native scoreboard.
4. When the new score does not exceed the previous Telegram high,
   Telegram keeps the previous high. This is expected and **not** a failure
   to register the D1 weekly score.
5. The Worker requests \`getGameHighScores\` for the Game Card; Telegram
   normally returns the top few plus the player's nearest neighbors, **not**
   a complete worldwide list. The in-game **TG CHAT** tab displays exactly
   that partial response.
6. The game's result scene **automatically opens** the D1 weekly
   leaderboard after a successful save. The player can switch tabs or close
   the panel. The \`MISSIONS / BADGES\` status line also reopens the panel.
7. The bot's **/leaderboard** command opens a navigable Telegram inline-keyboard
   scoreboard (Day, Saturday-to-Saturday Week, Solar Hijri Month, All-time,
   and up to 12 preceding weeks). It shows the top ten, participant count,
   and the requesting user's personal rank even outside the top ten.
   **/top** and **/score** are aliases for the same menu.
   Switching tabs edits the existing bot message; it does not spam chats.
8. The keyboard includes a native link back to the official Telegram Game.
   The bot's **/help** lists all commands. A production deployment calls
   `getMyCommands` and `setMyCommands` to expose these commands in the
   Telegram / command picker while retaining any unrelated bot commands.

The D1 rankings are global across all players and Game Cards.
The native Telegram scoreboard is limited to its chat/message and uses
all-time personal highs; it cannot be reset weekly via D1. Do not
\`force\` a lower Telegram score to simulate a weekly reset, because
that corrupts Telegram's built-in all-time high-score history.

## Public and authenticated APIs

- \`GET https://mustache.zedai.ir/api/leaderboard?period=week\` current Tehran week.
- \`GET .../api/leaderboard?period=week&offset=1\` preceding week.
- \`GET .../api/leaderboard?period=day|month|all\` other periods.
- Valid \`Authorization: Bearer <tg_session>\` adds \`me\` for a Telegram
  user; otherwise the endpoint returns only public rankings.
- \`POST /api/round/start\` and \`POST /api/round/finish\` require the
  session. The latter includes \`telegramState\`:
  \`updated\`, \`previous_best\`, \`retry\`, or \`pending\`. D1 scores
  remain committed even if the Telegram update is temporarily unavailable.

## Release and migration

This change adds \`bot/migrations/0002_tehran_scoreboards.sql\`:
an indexed \`finished_at\` score lookup and a \`telegram_state\` field
to distinguish a new Telegram high from an existing higher score and a
retryable error.

The existing GitHub production workflow automatically applies D1
migrations before deploying the updated Worker and publishes the static
Phaser front end separately. **No new Cloudflare Secrets or second webhook
are needed.** Do not re-run Telegram \`setWebhook\` after deployment if
the existing \`mustache.zedai.ir/telegram/webhook\` is functional.

## Security restrictions

Telegram callback sessions authenticate identity, and the Worker
recomputes each score from the submitted impact trace. The game
still simulates target motion in the browser; a malicious client can
fabricate plausible target positions. This is **not prize-grade
anti-cheat**. Real N5 token awards or other valuable prizes remain
disabled until server-generated target schedules and independent
authoritative replay validation are implemented (Issue #6).

Do not log bearer tokens, Cloudflare API tokens or Telegram Bot Tokens.
The public leaderboard currently exposes first names supplied in
Telegram callbacks; consider optional public nicknames before a public
prize tournament.

## Using the bot command menu

Open **@RJTtobot** and send `/leaderboard`, or select **leaderboard**
in Telegram's `/` command menu after deploying this PR. The bot sends a
single message containing the current Tehran week ranking and inline buttons:

- **Today:** midnight-to-midnight `Asia/Tehran`.
- **Week:** Saturday 00:00 to the following Saturday 00:00 Tehran. Use
  the previous/next buttons to browse at most 12 older weeks.
- **Solar Hijri month:** current Iranian calendar month.
- **All-time:** highest score of each player across recorded history.
- **Play Mustache:** launches the official game.

All ranking data is read from the existing D1 queries. The requesting
Telegram user ID is obtained from Telegram's trusted `message.from` or
`callback_query.from`, never from user-provided callback data.
The public scoreboard is shared if displayed in a group; each person
pressing a tab button sees their own rank in that updated message.

The deployment workflow registers the command picker **after** a successful
Worker deploy. The registration script preserves existing default-scope
commands not owned by Mustache; it does not overwrite language-specific
or chat-specific command scopes. No extra secret or webhook is required.

The native Telegram Game Card high scores remain per-card/all-time;
the command displays the global D1 scoreboards instead.
