# Player progression, referrals and Gold Rush

This feature extends the **official Telegram Game**, not a Telegram Mini App. Browser
practice is still local-only. A valid Telegram Game callback issues the bearer session
that authorizes /api/profile and the competitive round API.

## Player profile (Cloudflare D1)

- game_progress stores XP, completed rounds and distinct active Tehran days. Only
  server-validated, accepted 45-second rounds update it.
- Earn 40 + min(20, floor(rawScore/100)) XP per completed verified round.
- Level = 1 + floor(XP / 500); leveling is cosmetic and never affects hitboxes.
- Unlock Gold Rush permanently at **12 completed rounds across at least 2 different
  Tehran days**. Pre-existing historical scores are retained but **not retroactively
  counted** towards new XP/unlock counters. Explain this to returning players.
- Player profile and invite URL are available in the menu, via /profile
  and authenticated GET /api/profile. Three daily classic missions (play two rounds,
  score at least 1200 in a round, and a Golden Perfect) are computed from D1
  each Tehran day; they are visible in the profile and do not award tokens.

## Catch-up Golden Ticket

Players with at least five verified rounds can play **one** Gold Rush round per Tehran
day while in the bottom 30% of a weekly classic ranking with at least 20 players.
The Worker computes entitlement; a D1 transaction reserves the daily ticket
and creates its round together. An SQL uniqueness constraint
(user_id, tehran_day) prevents duplicate consumption. A failed round insert
rolls back the reservation. Once unlocked
permanently the daily limit disappears.

## Gold Rush game mode

The visual vault overlays the forest while preserving original lane geometry and
hit detection. All thrown mustaches are gold-looking projectiles. Original
three-of-five golden pickup mechanic is disabled in this mode. Scoring:
PERFECT = normal score + 50, plus 150 on every third consecutive PERFECT.
GOOD/MISS reset this special streak. Character variant and ordinary combo rewards
are unchanged. There is no infinite +350 golden pickup loop.

shared/modeRules.js is the shared client/Worker scoring contract.
game_rounds.mode and ranked_score retain mode-specific scoring and Classic-only
catch-up eligibility. Public rankings combine both modes, taking each player's
best verified single round (never summing rounds). Telegram-native Game Card receives **raw**
round score; it does not understand our per-mode or referral standings.

## Referral lifecycle

1. Player receives a Telegram deep link with start=ref_<base36 user id> via
   the menu or /invite.
2. Bot accepts a Telegram /start payload once for a never-scored identity.
   No reward is granted for clicking or opening a card.
3. When the new identity finishes a verified round, the Worker sets
   game_referrals.qualified_at once.
4. During the current Tehran day, the inviter receives +5% ranked points
   for each of the first three qualifying friends, max +15%, capped at
   **200 bonus points per classic round**. No retroactive score updates.
5. The Worker calculates and persists game_rounds.ranked_score; original
   score remains unchanged for Telegram Game Cards and player raw records.
   Gold Rush never receives referral multipliers.

The Worker also persists the accepted score, XP, progress marker and referral
qualification in **one D1 batch transaction**. A failure in any write rolls
back the entire finish, and retrying a completed round cannot grant XP twice.

This throttles gaming but is not a complete Sybil defense. Multiple legitimate-looking
Telegram identities remain possible. No monetary/token prizes may be awarded on
client-controlled hit traces. Future anti-abuse should include rate-limits,
server-controlled target schedules and fraud heuristics.

## Rollout and tests

- Run migration bot/migrations/0004_player_progression.sql **before** deploying
  new Worker (existing deploy workflow already runs migrations first).
- Merge and deploy backend/frontend together; avoid enabling Gold Rush if the API
  deploy is delayed. A rejected server mode never grants verified ranked points.
- Check desktop and 540x960 mobile, old classic scoring, duplicate /finish,
  referral /start, /profile, /invite, Tehran midnight reset, and
  the unified rankings with mode badges; Classic-only ticket eligibility must stay unchanged.
- Tests: npm run test:bot, npm test, npm run typecheck, npm run build.
