# Phaser 4 FX performance release notes

## Scope

A visual-only pass: reduce work per tap and keep pooled temporary sprites
scene-owned. Explicitly _not_ a physics, input or score rewrite.

| Profile | Detection                                          | Star burst (Perfect / Good) | Ambient insects | Falling leaves |
| ------- | -------------------------------------------------- | --------------------------- | --------------- | -------------- |
| Full    | Desktop/mobile with adequate hardware              | 14 / 9                      | 9               | Yes            |
| Low     | <=4 CPU cores or <=4 GB deviceMemory when reported | 7 / 5                       | 4               | No             |
| Reduced | OS prefers-reduced-motion                          | 0 / 0                       | 0               | No             |

Other bursts and projectile spark trails are similarly budgeted, but projectile
travel duration, visual hit position, Gold Rush flight paths and score are
identical across all profiles. One-shot effects are recycled, not cached
indefinitely (maximum 12 per texture per scene; destroyed on overflow/shutdown).

## Release acceptance

- GitHub Actions checks: format, lint, typecheck, unit/bot tests, build.
- Playwright smoke: menu, active selected hero, no page exceptions,
  desktop 960×540 and portrait 540×960, screenshots.
- Manual QA after deploy: Android and iOS Telegram WebViews.
- Recommended device benchmark: 10 consecutive 45s rounds in both modes,
  monitor frame budget/long tasks, verify no escalating scene object count.
  **No 60 FPS guarantee without this physical-device benchmark.**
- Pause/resume, tutorial, all Golden modes and reduced-motion should all
  retain identical scoring and timer behavior.
