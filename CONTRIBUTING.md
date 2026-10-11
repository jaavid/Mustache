# Contributing

1. Use Node.js 22 and `npm ci`. Commit the lockfile with any dependency changes.
2. Keep gameplay fixes separate from bulk formatting.
3. Add pure logic and regression tests under `src/logic/` and `src/logic/__tests__/`.
4. Run `npm run lint && npm run assets:check && npm run typecheck && npm test && npm run build`.
5. Validate both desktop **960 × 540** and mobile portrait **540 × 960**. Use the optional **Browser smoke and screenshots** GitHub workflow and inspect generated screenshots.
6. Keep [Asset manifest](assets/manifest.json) consistent with the PNG and generated texture keys. See [Art pipeline](assets/README.md).
7. Update CHANGELOG for user-visible changes; do not append obsolete release instructions to README.

Never change the calibrated lip position or move imperfect shots to a better visual landing point. No local score is prize-eligible.
