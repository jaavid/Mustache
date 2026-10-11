# Architecture and invariants

Mustache Mayhem is a client-only Phaser game. Vite bundles the code and one source PNG; Canvas produces decorative textures at runtime, Web Audio synthesizes audio, and localStorage stores practice statistics.

## Round lifecycle

1. The responsive entry point chooses the 960 × 540 or 540 × 960 scene.
2. The boot scene preloads Ramin and registers procedural textures.
3. A tree, pose and spawn event are selected; Ramin becomes scorable only after entering.
4. A tap or click launches a projectile toward that **exact pixel**.
5. At projectile impact, `resolveRoundShot` computes the grade, points, combo, character reward and round statistics _once_.
6. The scene renders reaction/effects and queues the next spawn.
7. After 45 seconds, the local result screen displays the score, medals and missions.

## Non-negotiable gameplay invariants

- One shot per appearance; never score before projectile arrival.
- The target is a **horizontal ellipse around the rotated upper-lip reference**, not the whole face.
- The visual mustache stays anchored to the actual landing coordinate as Ramin moves; never snap a GOOD hit to the perfect center.
- Only bark collision allows a MISS to stick on a tree.
- Mustache variants remain cosmetic; fake-outs do not penalize combo.
- Brow/eye animations must use **whole 210 × 362 expression frames**—never paint a second set of brows over an existing face.
- Hand touches and slips must not move a scorable hitbox; avoid stale idle-reset timers overriding new impact expressions.
- No local scores can authorize token rewards.
- Respect pause, reduced-motion settings and the 0–15/15–30/30–45 stage boundaries.

## Scene separation

Desktop and portrait scenes intentionally have different rendering and input layout. Scoring logic is unified in `src/logic/shotResolution.ts`; future consolidation of scene rendering should be separate from feature work.

## Quality

Use lockfile-based `npm ci`, ESLint, TypeScript strict, Vitest and an optional Playwright screenshot workflow. Screenshots are not yet a visual-diff acceptance gate.
