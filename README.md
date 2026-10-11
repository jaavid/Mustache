# N5 Mustache Mayhem

Pixel-art arcade game built with **Phaser 3, TypeScript, and Vite**.

**Play:** https://mustache.alexa.ir/

## Gameplay

Throw a mustache at the precise upper-lip location while Ramin peeks from three trees.

- **45 seconds** with distinct sunset (0–15 s), twilight (15–30 s), and night (30–45 s) stages.
- The projectile scores **at impact**; the sticker stays exactly where you aimed (no automatic correction).
- Hit areas are **elliptical**. Desktop radii: PERFECT 17 × 12, GOOD 33 × 21. Mobile portrait radii: PERFECT 21 × 15, GOOD 38 × 26 logical pixels.
- PERFECT = 100 points, GOOD = 50, MISS = 0; streak bonus +10 per extra hit, capped at +50. Gold Ramin adds +50; PERFECT on sunglasses adds +25.
- Mustache style only changes animation; it cannot give a scoring advantage.
- Misses stick to a tree **only** if the projectile actually hits its bark; otherwise they fall.
- Local best scores, missions and badges are stored in your browser. No prize eligibility or verified leaderboard.
- Pause/resume, independent SFX and music controls, first-run tutorial, and opt-in vibration.

**Controls:** click/tap to aim and shoot, use 1–3 to select styles on desktop, and P to pause. Desktop/landscape uses a 960 × 540 logical canvas; portrait mobile uses 540 × 960. Rotating restarts the current round.

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

| Files                                                | Responsibility                                             |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `src/main.ts`                                        | Viewport/layout selection                                  |
| `src/game/scenes.ts`, `src/game/mobile.ts`           | Desktop and mobile Phaser presentation                     |
| `src/logic/shotResolution.ts`                        | Shared shot outcome: score, combo, bonuses and round stats |
| `src/logic/scoring.ts`                               | Pure elliptical hit detection                              |
| `src/logic/gameplay.ts`, `src/logic/arcadePhases.ts` | Timings and difficulty                                     |
| `src/game/gameFeel.ts`, `src/game/impactFx.ts`       | Projectile and impact visuals                              |
| `src/game/ramin.ts`, `src/game/raminMoments.ts`      | Character states, expressions and gestures                 |
| `src/game/art.ts`                                    | Canvas-generated pixel art                                 |
| `src/game/facialAtlas.ts`                            | Six-frame Ramin atlas derived from original four frames    |
| `src/assets/ramin-sheet.png`                         | Original aligned Ramin image                               |

See [Architecture](docs/ARCHITECTURE.md), [Art pipeline](assets/README.md), [Contributing](CONTRIBUTING.md), and [Changelog](CHANGELOG.md).

## Tests and deployment

- Vitest tests pure game logic. ESLint and TypeScript `strict` cover code quality.
- The optional browser workflow runs smoke checks and collects mobile and desktop screenshots. Screenshots are **review artifacts**, not automated pixel-perfect baselines.
- Every push to `main` builds and deploys to GitHub Pages using relative Vite asset paths.
- This is a **static practice game**. It has no accounts, backend, authoritative ranking, blockchain integration, or token awards; browser scores are untrusted.

## Official Telegram Game (@rjtrobot)

The **Telegram Games API** integration uses the existing static Phaser game on
https://mustache.alexa.ir/ and a separate Cloudflare Worker for Bot API updates.
This is an official `/newgame` HTML5 Game, **not** a Telegram Mini App.

- Bot: `@rjtrobot`
- BotFather game short name: `mustache_mayhem`
- `/start` and `/play` send Telegram's native Game Card using `sendGame`.
- Pressing **Play** is handled through `answerCallbackQuery(url)`.
- Inline sharing is available after `/setinline` is enabled in BotFather.
- The results screen offers Telegram's native game sharing when opened through
  the official game; browser sharing still works on the public website.

See [Telegram Game setup](docs/TELEGRAM_GAME.md) to create the BotFather Game,
deploy the Worker, configure secrets and register its webhook. This repository
does **not** contain the bot token or configure a live webhook.

**Important:** Telegram's `setGameScore` / `getGameHighScores` are intentionally
**not enabled yet**: today's local scores are client-controlled. They must not be
published as verified scores or used for prizes until server-side round
validation and anti-cheat are implemented.
