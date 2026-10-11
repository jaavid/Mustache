# Art pipeline

Only **one committed raster image** exists: `src/assets/ramin-sheet.png`, a horizontally aligned **four-frame sheet** at 210 × 362 pixels per frame (overall 840 × 362).

Most forest visuals, mustaches, accessories, leaves, mist and effects are generated in `src/game/art.ts`. The six-frame expression atlas is synthesized in `src/game/facialAtlas.ts`, with two expressions derived from pixel regions of the original. Web Audio synthesizes music and SFX. Nothing is missing simply because there are few PNG files.

The machine-readable [manifest](manifest.json) records source images and generated texture ownership. Run `npm run assets:check` to check PNG signatures, frame dimensions and producer files.

## Hybrid workflow

- **Editable artist originals:** place actual layered `.aseprite` or LibreSprite files under `assets/source/` if created. **None exist yet.** Do not create empty placeholders and claim they are editable originals.
- **Runtime sprites:** export compressed atlas PNGs under `src/assets/` with stable texture keys and consistent frame dimensions.
- **Procedural effects:** retain mist, particles, simple tree decoration, light and spark effects in code where appropriate.
- **Audio:** synthesize simple audio until production sound design requires licensed external tracks.

## Ramin contract

The sprite remains exactly 210 × 362 pixels per frame. The shared upper-lip anchor is at frame Y=136. Idle, blink, surprised and victory originate in the four-frame source. Wink and serious/raised brows are currently reconstructed during boot by replacing pixel regions in complete sprite frames. This is a practical bridge, not a final fully hand-drawn expression atlas.

When real layered artwork becomes available, export six complete aligned artist-designed frames and remove runtime pixel-region composition in a dedicated, screenshot-reviewed change. Never draw extra brows and eyes on top of the existing ones.

## Checklist for adding art

1. Specify palette, logical dimensions, frame origin and hit-relevant anchor.
2. Store source and optimized atlas as appropriate; update `manifest.json`.
3. Register the stable Phaser texture key before any scene uses it.
4. Test both viewports and all three forest lighting phases.
5. Verify mustaches still land at their real pointer coordinate.
