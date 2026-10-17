# Forest art — production asset contract

## Final selection

Only **two** licensed Karsiori species are used, arranged **Cedar — Oak — Cedar**
over the game's original three tree lanes.

- Oak: original unmodified 70×98 PNG, `src/assets/forest/karsiori-oak-tree6-green.png`.
- Cedar / spruce: original 25-frame 74×128 PNG sheet (1850×128),
  `src/assets/forest/karsiori-large-spruce-night-sheet.png`.

Both are **CC0-1.0**, including commercial redistribution and modification.
Artist credit is optional but included below:

- [Karsiori FREE Pixel Art Tree Pack](https://karsiori.itch.io/free-pixel-art-tree-pack)
- [Karsiori FREE Pixel Art Spruce Tree Pack - Animated](https://karsiori.itch.io/spruce-tree-pack-pixel-art-animated)

## Implementation

The original source PNGs are loaded by Phaser in the Boot scene through Vite
asset URLs, not `public/` root paths. `src/game/forestTreeAssets.ts`
synthesizes four **96×220 transparent pixel canvas textures** once at boot:

- `tree-oak-back`: full original oak sprite including its natural trunk
- `tree-oak-front`: only the original lower oak pixels, clipped for occlusion
- `tree-cedar-back`: first original spruce frame including its natural trunk
- `tree-cedar-front`: only the original lower spruce pixels, clipped for occlusion

The complete source PNG is preserved in the repository; no generated source
files are claimed to be hand-authored Aseprite artwork. The source canopy
is nearest-neighbour resized into the common 96×220 texture space with fixed
trunk axis **x=48**. **No synthetic trunks are painted:** the front occluder
reuses pixels from the same licensed source image, clipped to the lower bark.
Foreground pixels stay in place at depth 28 while only
the rear canopy gently sways behind the character at depth 14. Reduced-motion
settings disable the sway.

Runtime positions and spawn selection remain identical in desktop and portrait.
Existing bark collision bounds, score processing, mouth aim and Gold Rush rules
are unchanged. These layers are deliberately separated so the hero disappears
behind the same stationary trunk used for failed moustache attachments.

## Validation before release

- [x] Exactly two licensed source sprites, no experimental willow.
- [x] Reuse the cedar source for both side lanes and oak for the center.
- [x] Keep 96×220 aligned back/front virtual textures.
- [x] Update image manifest and asset checks.
- [x] No `/forest-asset-review.html` or candidate preview page in production.
- [ ] Manually inspect real Telegram iOS/Android gameplay after deployment.
