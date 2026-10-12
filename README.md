# N5 Mustache Mayhem

Pixel-art arcade game built with **Phaser 3, TypeScript, and Vite**.

**Play:** https://mustache.alexa.ir/

## Gameplay

Choose **Ramin, Borhan or Mammad** in a six-second pre-round selection (1/2/3 on desktop, tap a hero on mobile), then throw a mustache at the precise upper-lip location while the chosen hero peeks from three trees. The current selection carries into the result screen and can be changed before every replay. **Borhan appears with a clean upper lip and separately aligned glasses.** **Borhan has his own three mustache silhouettes** (short, classic and heavy horseshoe), plus a matching golden special. **Mammad** uses the supplied four graduation poses, his own academic accessories and the standard mustache styles. All three share the same scoring/hit zones.

- **45 seconds** with distinct sunset (0–15 s), twilight (15–30 s), and night (30–45 s) stages.
- The projectile scores **at impact**; the sticker stays exactly where you aimed (no automatic correction).
- Hit areas are **elliptical**. Desktop radii: PERFECT 17 × 12, GOOD 33 × 21. Mobile portrait radii: PERFECT 21 × 15, GOOD 38 × 26 logical pixels.
- PERFECT = 100 points, GOOD = 50, MISS = 0; streak bonus +10 per extra hit, capped at +50. Gold character variant adds +50; PERFECT on sunglasses adds +25.
- Mustache style only changes animation; it cannot give a scoring advantage.
- Misses stick to a tree **only** if the projectile actually hits its bark; otherwise they fall.
- Local best scores, missions and badges are stored in your browser. No prize eligibility or verified leaderboard.
- Pause/resume, independent SFX and music controls, first-run tutorial, and opt-in vibration.

**Controls:** click/tap to aim and shoot, use 1–3 to select styles on desktop, and P to pause. Desktop/landscape uses a 960 × 540 logical canvas; portrait mobile uses 540 × 960. Rotating restarts the current round.

## Golden Mustache (score bonus)

Five golden mustaches fly across each 45-second round. They now cross in 1.8 seconds with a slight vertical weave and smaller collectible hit zones, validated identically on client and server. Catch three to turn the **middle mustache in the selector** golden. Tap/click that middle slot
(or press 2) to equip the special shot; ordinary shots with slots 1 and 3 preserve it.
Even if slot 2 was already selected, you must actively select it again after charging.
Only a PERFECT hit with the equipped golden projectile earns **+350 points**, in addition to
normal scoring. GOOD/MISS consume it without the golden bonus. Pickup taps do not consume
a Ramin shot or break a combo. This is an in-game score bonus,
**not** a NFIVE token or a financial prize. Telegram's leaderboard validates the pickup
trace and displays a golden badge for verified golden-perfect records.

See [Golden Mustache rules and integrity](docs/GOLDEN_MUSTACHE.md).

## Development

Use **Node.js 22**. Clone the repository and run:

```sh
npm ci
npm run dev
```

Run the quality gates before pushing:

```sh
npm run lint
npm run assets:check
npm run typecheck
npm test
npm run build
```

Run `npm run format` for documentation and config files. Formatting the whole legacy TypeScript tree is a **separate task** to keep formatting-only diffs apart from functional changes.

## Architecture

| Files                                                        | Responsibility                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/main.ts`                                                | Viewport/layout selection                                  |
| `src/game/scenes.ts`, `src/game/mobile.ts`                   | Desktop and mobile Phaser presentation                     |
| `src/logic/shotResolution.ts`                                | Shared shot outcome: score, combo, bonuses and round stats |
| `src/logic/scoring.ts`                                       | Pure elliptical hit detection                              |
| `src/logic/gameplay.ts`, `src/logic/arcadePhases.ts`         | Timings and difficulty                                     |
| `src/game/gameFeel.ts`, `src/game/impactFx.ts`               | Projectile and impact visuals                              |
| `src/game/ramin.ts`, `src/game/raminMoments.ts`              | Both heroes' states, expressions and gestures              |
| `src/game/characterSelect.ts`, `src/game/characterChoice.ts` | Six-second character selection shared by both layouts      |
| `src/game/art.ts`                                            | Canvas-generated pixel art                                 |
| `src/game/facialAtlas.ts`                                    | Six-frame Ramin atlas derived from original four frames    |
| `src/assets/ramin-sheet.png`, `src/assets/borhan-sheet.png`, `src/assets/mammad-sheet.png`  | Aligned four-frame character sprite sheets                 |

See [Architecture](docs/ARCHITECTURE.md), [Art pipeline](assets/README.md), [Contributing](CONTRIBUTING.md), and [Changelog](CHANGELOG.md).

## Tests and deployment

- Vitest tests pure game logic. ESLint and TypeScript `strict` cover code quality.
- The optional browser workflow runs smoke checks and collects mobile and desktop screenshots. Screenshots are **review artifacts**, not automated pixel-perfect baselines.
- Every push to `main` builds and deploys to GitHub Pages using relative Vite asset paths.
- Standalone browser play stays local-only. Official Telegram Game sessions use a separate Cloudflare Worker and D1 weekly board; no blockchain integration or token awards are enabled, and submitted impact traces are not prize-grade proof.

## Official Telegram Game (@RJTtobot)

The **Telegram Games API** integration uses the existing static Phaser game on
https://mustache.alexa.ir/ and a separate Cloudflare Worker for Bot API updates.
This is an official `/newgame` HTML5 Game, **not** a Telegram Mini App.

- Bot: `@RJTtobot`
- BotFather game short name: `mustache`
- `/start` and `/play` send Telegram's native Game Card using `sendGame`.
- Pressing **Play** is handled through `answerCallbackQuery(url)`.
- Inline sharing is available after `/setinline` is enabled in BotFather.
- The results screen offers Telegram's native game sharing when opened through
  the official game; browser sharing still works on the public website.

See [Telegram Game setup](docs/TELEGRAM_GAME.md) for the BotFather configuration,
GitHub production secrets, automatic Cloudflare Worker deployment and
one-time Telegram webhook registration. Merges that change `bot/**` deploy
through `cloudflare/wrangler-action@v4`; GitHub Pages remains independent.
No credentials are committed, and the workflow never replaces an existing
Telegram webhook.

**Important:** Telegram `setGameScore` / `getGameHighScores` are enabled for
Telegram-authenticated rounds. The server recalculates shot arithmetic, but
client-controlled target positions are not proof of honest play. Do not award
real tokens or prizes until server-authoritative anti-cheat is implemented.

## Weekly score service (Cloudflare D1)

Official Telegram Game launches issue short-lived per-player sessions on
`mustache.zedai.ir`. The browser submits an impact trace; the Worker
recalculates the score, stores a weekly best in D1 and attempts
`setGameScore` for the original Game Card. The result screen includes a
automatically opened Saturday-to-Saturday Tehran weekly top-ten panel, with daily,
Persian-monthly, all-time, Telegram chat tabs and the player's rank.

Deployment uses the existing `CLOUDFLARE_D1_DATABASE_ID` GitHub production secret
and `n5-mustache-scores` D1 database. CI applies SQL migrations **before** deploying the Worker. See
[Telegram scoring and D1 setup](docs/TELEGRAM_SCORES.md).

**Scores are not prize-grade.** Server arithmetic validation cannot establish
that a client-controlled animated target was genuinely hit; do not award N5
tokens based on these records.

## Tehran competitions

Weekly contest windows are Saturday 00:00 to next Saturday 00:00
\`Asia/Tehran\` (start inclusive, end exclusive). The month tab follows the
**Solar Hijri calendar** in Tehran. Original scores remain in D1 and are
rebucketed by \`finished_at\`, with no destructive migration.

After a native Telegram round is accepted, the game automatically displays
the weekly top ten, personal rank and Telegram sync status. A new personal
high is sent through \`setGameScore\`, updating the original Telegram
Game Card. Telegram chat scores remain all-time and chat-local, distinct
from global weekly D1 rankings. Bot command `/leaderboard` opens interactive Day / Tehran Week / Persian Month /
All-time rankings and previous weeks, with `/top` and `/score` as aliases.
The GitHub Worker deployment registers these commands in Telegram's slash
menu without overwriting unrelated default-scope commands.
