# Agent instructions — Mustache Mayhem

- Keep this **Phaser 3 + TypeScript + Vite** arcade prototype small and standalone. No React/Next.js, backend, wallets, or on-chain calls until explicitly requested.
- Maintain `960×540` Phaser logical coordinates and FIT scaling. All input coordinates and distance checks must be in Phaser world/screen coordinates, not raw DOM coordinates.
- Prefer pixel-art generated sprites and crisp nearest-neighbor rendering. Avoid remote runtime assets that could break on GitHub Pages.
- Keep game logic for scoring pure and tested in `src/logic/`.
- All changes must pass `npm run typecheck`, `npm test` and `npm run build` when dependencies can be installed.
- GitHub Pages public URL is `https://jaavid.github.io/Mustache/`; only production build sets Vite base `/Mustache/`.
- Do not imply local high scores qualify for real NFIVE tokens.
