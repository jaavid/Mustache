# N5 · Mustache Mayhem 🎯

A **real playable pixel-art arcade prototype**, made with Phaser 3, Vite and TypeScript. Ramin pops out from behind three forest trees. Aim a flying mustache at the space directly beneath his nose before he disappears.

### Play online

Custom-domain GitHub Pages URL: **https://mustache.alexa.ir/**

### Local dev

Requires Node.js 20.19+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Navigate to the local URL printed by Vite. After the first install, commit the generated `package-lock.json` and switch CI from `npm install` to `npm ci` for reproducible installs.

### How to play

- Click **PLAY** or press **Enter**.
- During a **45-second** round, Ramin appears to the right of a random tree.
- Click/tap **just below his nose**. A mustache flies from the launcher to your aim point.
- **PERFECT:** within 19 pixels = 100 points; **GOOD:** within 43 pixels = 50 points; a miss gets 0.
- Consecutive hits add a capped combo bonus. One scoring hit per appearance.
- Pick from three mustache styles with the bar along the bottom; keys **1**, **2**, **3** also work.
- The game saves only **your personal best** in this browser using `localStorage`.
- Mobile portrait uses a separate touch-first 540×960 Phaser layout; landscape and desktop use the existing 960×540 game. Rotating restarts the current round.
- Portrait has large mustache selectors and slightly more forgiving touch aiming; the scoring formula stays unchanged.

### Test and build

```bash
npm run typecheck
npm test
npm run build
```

### Deployment

Every push to `main` runs the GitHub Pages workflow. Vite uses relative assets (`base: './'`) so the custom domain root and project subpaths work. The GitHub Pages workflow retains its `--mode pages` build. If GitHub Pages is not enabled, select **Settings → Pages → Build and deployment → Source: GitHub Actions** and rerun the action. The workflow attempts to enable Pages automatically if permitted.

### Prototype boundaries

No accounts, on-chain interactions, payout eligibility, server, multiplayer, global leaderboard, NFTs, or token rewards. This is an offline-friendly practice game (the first visit and package install still require network access). Scores can be modified by players and **must never** be trusted for token rewards.

### Pixel forest v0.2

- Three aligned character expressions (normal, blink, surprised) share the same upper-lip aim point.
- Animated rolling mist, fluttering butterflies, twinkling fireflies and foreground foliage.
- Leaves burst when Ramin emerges and sparkles burst after accurate shots.
- No remote media requests or backend; visuals are procedurally generated in Phaser.

### Next iterations

1. Replace procedural pixel-art Ramin with hand-crafted animation frames based on the reference portrait.
2. Add 4–6 detailed forest layers and muzzle/impact effects.
3. Tune appearance timing and add sound (with accessible mute toggle).
4. Introduce a verified server-authoritative scoreboard only when prizes become part of the scope.

### Mobile portrait v0.3

- Responsive scene selection on orientation change (mobile 540×960; desktop/landscape 960×540).
- Readable mobile HUD, large mustache selectors and a taller aiming area.
- Hit grading uses 0.8× touch distance to make facial targeting on small screens practical.
- No backend, ranking, or token payout.
