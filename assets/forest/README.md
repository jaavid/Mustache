# Mustache Mayhem — staged forest asset pack

## Current status
- [x] `tree_oak_back.png` — complete v1, ready for visual review.
- [ ] `tree_oak_front.png` — matching foreground trunk, roots and bark.
- [ ] Cedar back/front.
- [ ] Willow back/front.
- [ ] Ground, foliage, revised layout and mobile HUD-safe composition.

**This branch is a working art-pack branch, not a deployable scene replacement yet.**
Do not merge until both layers of all trees have been aligned, visually tested in
portrait and landscape, and connected to Phaser. Existing procedural trees remain
live in `src/game/art.ts` until then. Runtime scoring and hit geometry are unchanged.

## tree_oak_back.png (v1)
- **Path:** `src/assets/forest/tree_oak_back.png`
- **Format:** 96×220 PNG, indexed 12-color palette with real alpha transparency.
- **Coordinate space:** x=48 is the exact stationary trunk axis shared with the
  existing front occluder. Same 96×220 bounds and texture center as original
  `tree-back-0`. Registration will preserve these dimensions.
- **Contents:** broad oak crown, multi-layer light and shadow pixel foliage,
  and rear branches / rear trunk. No painted background, platform, text or HUD.
- **Depth:** place the crown behind the hero (same relative depth as the
  existing back layer). Front bark stays anchored and stationary.
- **Art direction:** chunky pixel edges, midnight teal shadow outlines,
  cool layered foliage with sparse warm highlights. Avoid willow droops and
  cedar-like triangular silhouettes.
- **Testing:** at native size and at the existing displayed sizes
  (190×430 landscape, 146×430 portrait), verify crown reads as a broad oak
  without swallowing the character's face or overlapping interactive HUD.
  When the new front arrives, validate bark and actual miss impacts.

No source .aseprite file is asserted; the deliverable is the exported PNG.
