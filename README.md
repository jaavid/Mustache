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
- Mobile supports touch; use landscape orientation for a larger game view.

### Test and build

```bash
npm run typecheck
npm test
npm run build
```

### Deployment

Every push to `main` runs the GitHub Pages workflow. Vite uses relative assets (`base: './'`) so the game works at the custom-domain root and under a project subpath. The existing workflow uses `--mode pages` but no longer hardcodes `/Mustache/`. If GitHub Pages is not enabled, select **Settings → Pages → Build and deployment → Source: GitHub Actions** and rerun the action. The workflow attempts to enable Pages automatically if permitted.

### Prototype boundaries

No accounts, on-chain interactions, payout eligibility, server, multiplayer, global leaderboard, NFTs, or token rewards. This is an offline-friendly practice game (the first visit and package install still require network access). Scores can be modified by players and **must never** be trusted for token rewards.

### Next iterations

1. Replace procedural pixel-art Ramin with hand-crafted animation frames based on the reference portrait.
2. Add 4–6 detailed forest layers and muzzle/impact effects.
3. Tune appearance timing and add sound (with accessible mute toggle).
4. Introduce a verified server-authoritative scoreboard only when prizes become part of the scope.
