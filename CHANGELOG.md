# Changelog

## v0.9.9 — Codebase and art-pipeline maintenance

- Consolidated scoring transactions for desktop and portrait into a single tested module.
- Added current-state documentation, development guidelines and an asset inventory.
- Introduced conservative linting, asset checks and optional browser smoke tests.
- Kept the game's mechanics and visuals unchanged.

## Historical notes (v0.1 through v0.9.8.2)

The previous README is preserved below for history. **Some sections describe superseded mechanics**; the main README is authoritative for current behavior.

---

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

1. Tune appearance timing and add sound (with accessible mute toggle).
2. Add secondary poses for lateral pop-outs and a tighter results composition.
3. Replace placeholder moustaches with higher-detail pixel variants and impact FX.
4. Introduce a verified server-authoritative scoreboard only when prizes become part of the scope.

### Mobile portrait v0.3

- Responsive scene selection on orientation change (mobile 540×960; desktop/landscape 960×540).
- Readable mobile HUD, large mustache selectors and a taller aiming area.
- Hit grading uses 0.8× touch distance to make facial targeting on small screens practical.
- No backend, ranking, or token payout.

### Portrait-driven Ramin sprite v0.4

- Replaced the procedural face/body with a dedicated four-frame, center-aligned transparent sprite sheet inspired by the provided portrait.
- Desktop and portrait-mobile both use the same frame set: idle, blink, surprised, and victory.
- Mustache placement now targets a calibrated upper-lip point computed from the sprite frame instead of a hard-coded generic face center.

- Asset: `src/assets/ramin-sheet.png` (4 × 420×724 frames), loaded through the Vite bundle.
- Animated blink / idle / surprised expressions and a victory bob with lip-attached mustache overlays.

### v0.5 — Mustaches, loader and audio

- Three truly different pixel mustache silhouettes: narrow classic, curled handlebar, and heavy walrus; derived from the approved concept art and packed into tiny offline raster masks.
- Smaller mustache overlays accurately fit Ramin's upper lip. Selection thumbnails stay large.
- Real Phaser loader progress HUD for sprite assets, no artificial waiting.
- Web Audio generated arcade effects for start, shoot, miss, good/perfect hit, and round completion; a persistent SFX toggle appears in menu, play and results on desktop and mobile.
- Sound is initialized after a user interaction; no external audio files, libraries, or backend.


### Gameplay Animation & Feel v0.6

- Ramin peeks, hops or darts sideways from behind a randomly selected tree. The same tree never appears twice in succession, and the leftmost mobile tree never spawns a clipped left-side pose.
- Difficulty gradually increases over the 45-second round while each appearance stays exposed for at least 990 ms **after** its entry animation. A missed shot or timed-out appearance breaks the combo.
- The mustache travels on a quadratic curved path with a spark trail. Scoring happens **on arrival**, not on pointer-down; one shot consumes one appearance and locks the target until impact.
- Hits trigger squash-and-stretch, synchronized face-attached mustache, small particles, combo pulse and a short PERFECT camera flash/shake.
- Pure geometry/timing functions have unit tests. No backend, online assets or real-token reward flow.

### v0.6.1 — Tree readability and genuine trunk occlusion

- Redesigned three distinct mossy pixel trees; removed all hanging lanterns from gameplay spawn lanes.
- Each tree renders as a back canopy (depth 14) and a fixed front bark occluder (depth 28). Ramin renders between them (depth 20); only the crown gently sways.
- Spawn coordinates now reference the exact rendered trunk axis. The outer trees always peek inward, and the middle tree supports both sides.
- Spaced mobile trees across the complete 540px portrait viewport; the face stays clear of the front bark when aiming and the body emerges from behind it.
- Added deterministic geometry and edge-lane tests without changing scoring, audio, menus or backend scope.


### v0.7 — Character variety and special events

- Appearance rates: regular 55%, sunglasses 18%, round glasses 12%, pink headband 10%, rare gold crown 5%. Procedurally generated transparent pixel accessories align with every character animation and rotation without covering the mouth.
- Golden Ramin awards +50 for GOOD or PERFECT. Sunglasses Ramin awards +25 for PERFECT only. Bonuses apply at projectile impact; misses cannot gain bonuses.
- After six seconds (but not in the last six), telegraphed FAKE-OUTs can appear (up to 7%); they ignore taps, do not fire, and do not break combos.
- DOUBLE POP (~12%) queues a rapid second scorable appearance at another tree. Each appearance is one shot, as before.
- Pure probability/bonus rules have unit tests; scores remain local-only practice scores, not redeemable rewards.

### v0.8 — Arcade experience and onboarding

- The pink bandana is a broad neon-fuchsia ribbon with a visible knot and two pixel trailing tails, without covering the mouth.
- Procedural 8-bit forest music has separate persisted MUSIC and SFX toggles. It begins after PLAY and stops on finish or orientation change.
- A Pause button and P keyboard shortcut freeze the round, with a three-second countdown before resume; hiding the browser tab auto-pauses.
- Three tutorial steps guide first-time players for around 10 seconds. NEXT and SKIP allow fast onboarding without consuming round time.
- Every impact records hits, misses, Perfects and maximum combo. Results now display accuracy and Bronze/Silver/Gold medals.
- Opt-in haptic feedback (off by default) is available through the Pause overlay on compatible mobile devices.
- Local practice only: no server, accounts or token rewards.

### v0.9.1–v0.9.5 — Arcade polish and replayability

- **v0.9.1 — HUD and UI:** shared arcade frame styling, readable phase/time meter and improved mobile result layout with dedicated space for sharing.
- **v0.9.2 — living forest:** multi-layer fog/parallax, windborne leaves and dynamic sunset-to-night lighting. Small character taunts appear occasionally without changing hit detection.
- **v0.9.3 — 3-phase pacing:** 0–15s warmup, 15–30s groove, 30–45s finale; speed increases within tested lower bounds. Combo milestones, impact shockwaves and phase announcements make accuracy more rewarding.
- **v0.9.4 — replay goals:** three measurable round missions, five persistent local badges, new-unlock feedback and a shareable text result (Web Share or clipboard). Shared text clearly states that scores are local/unverified.
- **v0.9.5 — QA and balance:** deterministic tests cover phase thresholds, fair windows, combo rewards, local goals and share attribution. Reduced-motion preference suppresses extra ambient movement.
- No server, wallet, token payments or fraud-proof tournament claims.

- Final v0.9.5 polish: all three live quest targets are visible during play, pointer events on the mustache selector do not bubble into shooting, and 5× Perfect streaks add a short tween-only slow-motion beat. An occasional triumphant Ramin pose rewards sustained precision.


### v0.9.6 — Three clearly visible stages (lighting + pacing fix)

Previous phase tuning was too subtle: low-opacity lighting sat behind the character/trees, and dwell differences were often only a fraction of a second.

- **00–15s SUNSET:** full-scene amber lighting + glowing sun; warm-up aim windows 1.78–2.05s, slow music at 112 BPM, no surprise events.
- **15–30s TWILIGHT:** visible violet tint and emerging stars/moon; aim windows 1.26–1.51s, music rises to 132 BPM, fake-outs and double-pops enabled.
- **30–45s NIGHT RUSH:** dark navy stage lighting, moon and bright stars, mobile/desktop face spotlight to keep the lip visible; aim windows 1.05–1.19s and 160 BPM music; more frequent double-pops until the last six seconds.
- Prominent STAGE 2/3 and STAGE 3/3 transition banners, distinct phase HUD labels, colored mist, stage chimes. Hit detection and scoring thresholds are unchanged.
- Dynamic night coloring now sits over **the whole playfield but beneath the HUD** (depth 41), rather than only coloring the distant background. The face light is purely visual and does not change targeting.


### v0.9.7–v0.9.8 — Impact polish and real Ramin moments

- **Impact personality:** each of the three selectable mustaches has a distinctive visual attachment bounce (snappy, curly/twirly, heavy). All share exactly the same hit evaluation, combo math and score; this is NOT a pay-to-win or style handicap.
- **Miss-to-tree:** after a failed projectile impact, a pink-tinted duplicate drifts to the nearest tree and briefly sticks there, dislodging leaf pixels. It does not change shot origin, hit point or scored result.
- **Physical character gags:** bold serious eyebrows, a short wink/taunt, a genuine sunglasses-lift performed by the independent accessory layer, post-Perfect mustache touch using a little animated hand, and an occasional overbalanced slip before exiting behind a tree.
- **Fairness:** no active targeting windows or lip coordinates are moved by any moment. Hand contact runs only AFTER a confirmed Perfect (combo ≥2). Slip runs only AFTER an appearance is no longer targetable. A 4.8s scene-time cooldown restricts repeats. Visual-only effects obey pause/resume automatically.
- New deterministic unit tests validate probabilities/cooldowns and mustache impact plans; no backend changes.

### v0.9.8.1 — Honest aiming and non-magnetic misses

- Previously any GOOD/PERFECT sticker jumped to lip center and was recentered every frame. New stickers stay at the actual landing coordinate relative to the moving/rotating hero.
- A narrower horizontal ellipse replaces the 43px-radius face circle. Desktop PERFECT radius 17×12, GOOD 33×21; mobile 21×15 and 38×26 for finger tolerance.
- A precision crosshair marks the actual landing. GOOD adds a small reference dot at the ideal mouth center and a displacement line.
- Missed throws stick to a tree only when the actual aim point collides with visible trunk bark; all other misses fall/fade without any nearest-tree attraction.
- All three cosmetic mustache bounce patterns and original combo/point bonuses remain; stored personal best is unchanged.


### v0.9.8.2 — Complete-frame facial animation fix

The old `ramin-emote-serious` and `ramin-emote-wink` transparent overlays were drawn over the original painted eyes and eyebrows, producing duplicates. Both effects now use **actual full-body sprite frames** from a six-frame, 210×362 canvas sprite sheet built at boot from the existing Ramin art:

- Frames 0–3 reproduce the original idle, blink, surprise and victory poses.
- Frame 4 starts with the idle illustration, then **replaces** the left-eye pixel region with the original closed-eye pose, so the other eye stays open (wink).
- Frame 5 starts with the idle illustration, then **replaces** the brow pixels with the original surprised/raised-brow artwork. Existing brows are overwritten rather than drawn twice.
- These two new frames are composed once, not in every render tick. No additional eye/brow layers exist in gameplay. Other accessories and the mustache-touch hand remain separate scene objects.
- Facial gestures return to idle after 540ms, unless an impact has already selected a different expression; pending resets are cancelled on spawn and hit.
- Mouth anchor, canvas dimensions, hit detection and sticker coordinates stay unchanged.

