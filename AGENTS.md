# Agent instructions — Mustache Mayhem

- Keep this **Phaser 3 + TypeScript + Vite** arcade prototype small and standalone. No React/Next.js, backend, wallets, or on-chain calls until explicitly requested.
- Maintain `960×540` for desktop/landscape and `540×960` for mobile portrait, both with FIT scaling. Keep scene-specific gameplay coordinates in Phaser space, not raw DOM coordinates.
- Prefer pixel-art generated sprites and crisp nearest-neighbor rendering. Avoid remote runtime assets that could break on GitHub Pages.
- Keep game logic for scoring pure and tested in `src/logic/`.
- All changes must pass `npm run typecheck`, `npm test` and `npm run build` when dependencies can be installed.
- GitHub Pages canonical URL is `https://mustache.alexa.ir/`. Use Vite `base: './'` so custom-domain root and repo subpath both resolve assets.
- Do not imply local high scores qualify for real NFIVE tokens.

- v0.6: Scoring must happen at projectile impact; never before the mustache visually arrives. Appearance serials invalidate old timeouts; preserve one-shot-per-pop and mobile portrait-safe X positioning.

- v0.7: Keep cosmetic accessories aligned to the 210×362 sprite and do not cover the mouth. Fake-outs cannot reduce combo. Double-pop follow-up must use a different tree and remain scorable. Only grant bonus on confirmed projectile impact.

- v0.8: Pause and tutorial overlays must run independently of the paused Play scene. Stop music on scene shutdown and orientation remount. Keep HUD touch targets safe and record stats exclusively at projectile impact.

- v0.9: Maintain three independently tested round phases (0–15, 15–30, 30–45s) and fair minimum exposure. Present mission/share scores as unverified local practice only. Keep extra VFX behind input UI and avoid visual overlap on 540×960 mobile. Respect reduced-motion preferences for new ambience.

- v0.9.7/v0.9.8: RaminMoments overlays MUST NOT displace the active hero/lip hitbox. `onHit` only after impact evaluation; optional slip only once target becomes inactive. `moments.clear()` at next spawn, render `moments.update()` after accessory sync. Mustache style effects remain cosmetic for scoring. Keep both desktop/mobile scenes symmetric.

- v0.9.8.1: Use evaluateAim for true-aim elliptical lip scoring. GOOD/PERFECT must visually land at the pointer location via the rotated local sticker anchor (no snap to lip center). Tree misses require bark collision; all other misses fall. Keep desktop/mobile parity.
