# Art pipeline

Three committed raster character sprite sheets exist: `src/assets/ramin-sheet.png`, `src/assets/borhan-sheet.png` (both four 210 × 362 frames), and `src/assets/mammad-sheet.png` (four 87 × 150 frames). Mammad's intentionally compact pixel-art export renders at the same 210 × 362 gameplay size.

Most forest visuals, mustaches, accessories, leaves, mist and effects are generated in `src/game/art.ts`. Six-frame expression atlases are synthesized in `src/game/facialAtlas.ts`. Only Ramin's wink and raised brows require pixel-region composition; Borhan and Mammad use their complete supplied expression frames. Web Audio synthesizes music and SFX. Nothing is missing simply because there are few PNG files.

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

## Mammad contract

Mammad's four poses were derived from the supplied graduation artwork (idle, wink, surprise, victory). The optimized transparent source is four horizontal frames at **87 × 150**, displayed at **210 × 362** in-game. All expressions keep the same anchor, with the upper lip calibrated at virtual Y=136. The wink frame also serves blink, and neutral serves the fallback serious frame; no duplicate facial overlays are added. His mortarboard remains visible with cap-specific headband and gold accessories. The standard three mustache styles and gold projectile are shared with Ramin; score validation is unchanged.

## In-progress hand-authored forest pack

`src/assets/forest/tree_oak_back.png` begins the native 96×220 forest asset pack.
It is intentionally staged without replacing the runtime tree textures until its
paired `tree_oak_front`, the other species and mobile layout have been reviewed.
See [forest asset status](forest/README.md).

## Verified CC0 third-party candidates

Three _original, unmodified_ Karsiori tree sprites are currently staged in `public/forest-candidates/` for comparison, **not activated in gameplay**. Their source repository mirrors and the original CC0 itch.io author pages are recorded in [the comparison](../docs/FOREST_ASSET_COMPARISON.md). The previous hand-authored `tree_oak_back.png` remains a separate candidate. In-game art must not be switched until both occlusion layers and the target alignment are approved.
