# Golden Mustache — gameplay and competitive scoring

The collectible golden mustache is **not** Ramin's existing rare golden variant. Both remain in the game.

## Rules (45-second active round)

- Five **public, deterministic** 2.5-second flyovers start at 7, 14, 21, 28 and 35 seconds. Alternating directions and layout-specific lanes have exactly the same schedule for all players.
- Tap the golden mustache while it is in flight. A pickup never launches an ordinary shot, resets the combo or grants direct points.
- Exactly **three different successful pickups** charge **one** golden projectile. Further flyovers are disabled after charging.
- The middle (slot **2**) mustache in the bottom selector turns golden and pulses. Existing selection remains unchanged, and the golden shot is **not** armed automatically — even if slot 2 was already selected before the third pickup. To equip it, explicitly tap/click slot 2 (or press 2 on a keyboard) after charging. Switch back to slot 1 or 3 at any time to save the charge. Ordinary shots do not spend it.
- After equipping gold, the next shot at Ramin consumes the one-use golden projectile, including a GOOD or MISS. The middle slot returns to the standard style after consumption.
- Only a PERFECT golden projectile grants **+350 bonus** in addition to the usual hit, combo and Ramin-variant rewards. GOOD/MISS consume the charge with **zero golden bonus**.
- The golden projectile still lands at the actual pointer coordinates at impact, with normal GOOD/PERFECT hit boxes. No auto snap.
- Progress is per-round, not a wallet asset. No NFT, NFIVE token or financial rewards.

## Competitive score integrity and rankings

`shared/goldenRules.js` is imported by Phaser and the Cloudflare Worker; the server does **not** trust pickup center coordinates, score claims, or the `goldenShot` flag. It recalculates the gold flight trajectory, validates unique pickup times/touch ellipses, reconstructs the one-use charge, accepts ordinary shots while charge is held, rejects premature or repeated gold claims, and recomputes the final score. Invalid pickup events or dishonest bonuses reject the round; older clients without pickups still work.

The D1 migration adds a zero-default `golden_perfect` field. Existing historical scores are unchanged. Day/week/Persian-month/all-time continue showing **the player's best single round**. Score is the primary order; in an exact score tie, a Golden Perfect badge wins, followed by stable user ID. The bot shows `🥇`, and the Phaser leaderboard displays `★` next to winning rounds.

The next regular Tehran weekly rollover (Saturday 00:00) is a clean weekly competition window; past weeks remain browsable. It is **not** a retroactive rewrite of historical rankings or Telegram's all-time Game Card scores.

**Anti-cheat limitation:** although collectible flight is recomputed independently and replay attacks are bounded, Ramin's positions and client event times remain controlled by the browser. This is not independent replay proof. Never award cryptocurrency or valuable prizes from these leaderboards until target schedules and timestamps are independently authoritative.

## Regression checks

- Geometry for both 960×540 desktop and 540×960 portrait layouts
- Manual slot-2 arming (including re-selecting an already-active slot), saved charge across ordinary shots, PERFECT-only bonus and GOOD/MISS consumption
- Duplicate, fabricated, premature or replayed pickup rejection
- Server score parity, old-client compatibility and migration defaults
- Results/Telegram badge for the verified best round
