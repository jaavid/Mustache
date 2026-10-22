# Umami: acquisition, gameplay and replay

## Integration and privacy boundary

The client loads `https://stats.tamin24.ir/script.js` for website
`71429b79-9586-4ec3-ad7a-8ab00e8ac68e` through
[`analytics.ts`](../src/platform/analytics.ts), **not** an ordinary auto-tracking
HTML snippet. Initialization happens after the competitive bridge consumes the
Telegram bearer token. There are no new dependencies or backend migrations.

- Automatic page/history tracking is disabled. Every manual pageview/event uses
  Umami's callback API to construct a new payload: URL `/`, empty referrer,
  fixed title, website ID, current hostname, tracker-provided screen/language,
  and allowlisted event data. Query strings, hash, names and default event data
  are never copied. Existing HTML also uses `referrer=no-referrer`.
- No Telegram IDs, usernames, session/round IDs, wallet information, invite
  links, coordinates, shot traces, error messages/stacks or DOM text go to Umami.
  Competitive traces still go to the **existing game backend**, not analytics.
- **The supplied `recorder.js` is intentionally NOT loaded.** Its implementation
  and masking/consent API could not be inspected from this environment. Recording
  a profile, leaderboard or launch URL could expose sensitive information, and
  DOM recordings do not automatically reproduce Phaser Canvas gameplay. Do not
  enable it until a separate consent, masking, Canvas and data-retention review.
- Standard Umami metadata and server request metadata (including IP at the
  receiving server) are still controlled by the self-hosted service. Review its
  retention, access controls, privacy notice and applicable consent requirements
  before production deployment. This adapter is not a legal consent mechanism.
- DNT, Global Privacy Control and `localStorage['umami.disabled']` equal to `1`
  or `true` disable loading. Unreadable privacy storage fails closed; visit-date
  write failures use an `unknown` cohort. The opt-out is also checked before each
  outgoing event. No custom persistent visitor ID is
  created and `umami.identify` is never called.
- Only `mustache.alexa.ir` and `jaavid.github.io` enable collection; local and
  preview hosts never send production data. Add a new host explicitly if needed.
- Analytics never gates gameplay. Delayed loading buffers at most 60 events;
  script failure discards pending events. Synchronous exceptions and rejected
  tracker promises are swallowed. There is no retry loop or per-shot stream.

The remote tracker and dashboard were unreachable through the environment's
network policy during implementation. Unit tests exercise the callback contract
with a fake tracker; they **do not** verify the deployed tracker version,
collector responses, dashboard permissions, CORS or CSP. Complete the production
acceptance checklist below after deployment.

## Common properties

All custom events carry `app_version`, `schema_version=1`, `launch`
(`official_telegram` or `browser`), `visit_type`, `return_gap`,
`acquisition_source` and `campaign`.

Gameplay/UI events also snapshot `mode` (`classic`/`goldRush`) and `character`
(`ramin`/`borhan`/`mammad`) when queued, not when the script finally loads.
Scene events carry `layout` (`portrait`/`landscape`). Lifecycle events add
`round_number`, a **page-local** ordinal: initial menu intent is 0; the first
actual round is 1. It is not an account/session identifier. Asynchronous score
responses preserve the mode/character/layout from their originating round.

A single localStorage key, `mustache-analytics-last-visit-v1`, stores only the
last UTC visit date (`YYYY-MM-DD`), not an identifier. Cohorts are:

- `visit_type`: `new`, `same_day`, `returning`, `unknown`.
- `return_gap`: `first`, `same_day`, `one_day`, `two_to_seven_days`,
  `eight_to_thirty_days`, `over_thirty_days`, `unknown`.

These are browser-storage visit hints, **not true D1/D7 cohort retention**.
Cleared storage, shared devices, time-zone boundaries, repeated page loads and
other devices change the interpretation. Use Umami's supported retention report
or trusted server-side active-day aggregates for stronger retention analysis;
never export Telegram identity into Umami just to join these datasets.

## Safe acquisition tags

Only these exact URL values are retained as categories:

| Query parameter | Allowed values                                                           |
| --------------- | ------------------------------------------------------------------------ |
| `utm_source`    | `telegram`, `instagram`, `google`, `youtube`, `x`, `discord`, `friend`   |
| `utm_campaign`  | `launch`, `daily_challenge`, `friend_challenge`, `group_test`, `organic` |

Unknown source values become `direct_or_other` (or `telegram` for official
Telegram launches); unknown campaigns become `none`. Other query values and
referrers are discarded, including `utm_content`, ad click IDs and referral IDs.
Example public test link:

`https://mustache.alexa.ir/?utm_source=telegram&utm_campaign=group_test`

For official Telegram launch attribution, the bot must preserve these safe tags
on the actual game URL; tagging a Telegram bot link alone does not guarantee
propagation. This change does not alter the bot's verified referral flow or add
tracking parameters to player-specific invite links.

## Event dictionary

| Events                                                         | Trigger / data / interpretation                                                                                                                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_start`                                                | Once per page initialization; not necessarily one native Umami session.                                                                                                                                        |
| `game_ready`                                                   | First Boot completion per page, with `load_ms` since analytics initialization (not full network navigation time).                                                                                              |
| `asset_load_failed`                                            | First loader failure per Boot; categorical only, no asset URL.                                                                                                                                                 |
| `client_error`                                                 | At most one each `error_type=runtime/unhandled_rejection` per page; no message/stack.                                                                                                                          |
| `layout_change`                                                | Viewport portrait breakpoint change; active gameplay may defer actual remount.                                                                                                                                 |
| `menu_view`, `play_click`                                      | Menu creation and actual Classic/available Gold Rush start action.                                                                                                                                             |
| `character_select_view`, `character_selected`                  | Picker viewed; only real pointer/keyboard selection, not initial default.                                                                                                                                      |
| `character_confirm`                                            | Picker launch, `source=ready/timeout/keyboard`. Replay currently skips picker.                                                                                                                                 |
| `tutorial_start`, `tutorial_step`, `tutorial_end`              | Tutorial shown; each rendered `step=1..3` once; `outcome=completed/skipped`. Auto-advance also counts as completion, not proof of comprehension.                                                               |
| `round_start`                                                  | First active update beside competitive start, after tutorial; local practice included.                                                                                                                         |
| `first_shot`                                                   | First **confirmed projectile impact**, including a miss; not pointerdown.                                                                                                                                      |
| `round_checkpoint`                                             | Once at 15 and 30 active seconds, `checkpoint_seconds`; pause/tutorial time excluded.                                                                                                                          |
| `round_end`                                                    | Results transition with `reason=completed/early_exit`; ESC is early exit.                                                                                                                                      |
| `round_abandon`                                                | Active scene shutdown or non-persisted `pagehide`, `reason=shutdown/pagehide`. Best effort only.                                                                                                               |
| `replay_click`                                                 | Actual replay action on Results, including keyboard.                                                                                                                                                           |
| `pause`, `resume`                                              | Actual pause and completed resume countdown; `source=manual/visibility`. Hiding a tab is not abandonment.                                                                                                      |
| `share_click`, `share_result`                                  | Share intent and bounded `channel/outcome`; see semantics below.                                                                                                                                               |
| `profile_view`                                                 | Profile panel shown, `status=loaded/unavailable`. No profile attributes.                                                                                                                                       |
| `invite_click`, `invite_result`                                | Invite-copy intent and `outcome=copied/prompted/failed`; no link.                                                                                                                                              |
| `gold_rush_click`                                              | Gold Rush gate action, `status=locked/ticket_confirmation/available`; loading-state clicks ignored.                                                                                                            |
| `leaderboard_view`, `leaderboard_filter`, `leaderboard_result` | Overlay view, explicit `filter` action and `outcome=loaded/failed`. Filters: day/week/month/all/telegram; historical `week_offset` is bounded. Stale/closed async results ignored.                             |
| `golden_pickup`, `golden_ready`, `golden_used`                 | Valid pickup with cumulative `count`; full charge and deliberate golden-shot spend. Not every attempted tap or spawn.                                                                                          |
| `round_start_result`                                           | Authenticated round issuance outcome `started/failed`, `duration_ms`, categorical failure only. Not emitted for local practice.                                                                                |
| `score_submit`                                                 | `outcome=local/saved/unavailable`, authenticated request `duration_ms`; saved outcomes include bounded `telegram_state`. `saved` means game backend accepted it, not necessarily a new Telegram personal best. |

`first_shot`, checkpoints and terminations contain aggregates:
`score`, `shots`, `perfect`, `good`, `miss`, `max_combo`, `accuracy` (0–100),
`active_elapsed_ms`. Values are bounded/rounded; no raw shot data is sent.
Client aggregates are **unverified analytics**, not rewards or anti-cheat evidence.
For trusted accepted-round metrics see
[`GAMEPLAY_TELEMETRY.md`](GAMEPLAY_TELEMETRY.md).

Share outcomes are deliberately distinct:

- Telegram `opened`: native share API was invoked, **not** proof of delivery.
- Native `completed`: Web Share API resolved; `cancelled` is AbortError.
- Clipboard `copied`: text was copied, **not** proof of posting.
- Prompt `prompted`: copy dialog returned; no actual-copy claim.
- `failed`: that channel failed; a fallback can subsequently succeed. Count
  attempts by channel or unique session, not all share results as successes.

An active round terminates once; pagehide and shutdown cannot both count it.
Persisted pagehide (bfcache) keeps the round; visibility pauses do not terminate
it. Browser process kills, blockers and failed unload requests still lose events.

## Suggested dashboard and decisions

Use the same time window and segment by layout, mode, launch, app version and
acquisition source. Where supported, build **session/visitor-based ordered
funnels**, rather than dividing unrelated total event counts:

1. Acquisition → activation: `session_start → menu_view → play_click →
character_confirm → round_start → first_shot`. Replay bypasses character
   selection and returning players may bypass tutorial, so analyze those paths
   separately. Low ready/menu rates suggest loading failures; low first-impact
   rates suggest onboarding/input friction.
2. Completion: `round_start → checkpoint(15) → checkpoint(30) →
round_end(reason=completed)`. Exclude `early_exit` from completions. Compare
   abandonment phase, active time, accuracy and zero-shot rounds by layout.
3. Replay: completed round → `replay_click →` next `round_start`. Event totals
   can exceed visitor totals; do not call `replay_click / round_start` a unique
   player retention rate.
4. Sharing: completed round → `share_click → share_result`, and separately
   `invite_click → invite_result`. Compare acquisition tags against subsequent
   starts. These do not establish delivered shares, referred signups or a viral
   coefficient; use the backend's verified referral data for that.
5. Return: compare `visit_type=returning` and `return_gap` distributions; inspect
   actual supported cohort reports/server active days for D1/D7 claims.
6. Reliability: `asset_load_failed`, `client_error`, `round_start_result=failed`,
   `score_submit=unavailable`, and failed leaderboard loads. Split errors by
   category (`network/authentication/validation/server/unknown`) before deciding
   whether a score failure is connectivity or validation.

Umami feature/report availability depends on the installed version. If a funnel
or numeric aggregation is unavailable, use event-property filters/exports;
clearly label simple count ratios as approximate. Change one gameplay variable
at a time, keep ranked scoring stable, and compare cohorts at equal traffic.

## Production acceptance checklist

1. Deploy the normal Vite build. Open a production-host game URL with safe UTM
   tags; verify exactly one manual pageview and `session_start/game_ready` in
   Umami's realtime event view. Do not paste the raw scripts into HTML as well.
2. Inspect collector request bodies in browser DevTools: URL `/`, empty referrer,
   fixed title, no query/hash/token/name/invite URL. Verify collector status,
   website authorization and tracker callback compatibility for this deployment.
3. Start from Telegram, finish and replay a round, then repeat in portrait.
   Verify first impact, two checkpoints, one terminal event, replay, tutorial
   completion/skip, manual/visibility pause, score saving and sharing outcomes.
4. Block the analytics script and collector separately: gameplay, scoring,
   tutorial, sharing and backend submission must continue normally.
5. Enable DNT/GPC or run `localStorage.setItem('umami.disabled', '1')` and reload:
   no tracker should load. Remove that key and reload to opt back in.
6. Confirm **no** `recorder.js` request and no recordings. Review the service's
   privacy/retention settings before enabling broader collection.

Local validation: `npm run typecheck`, `npm test`, `npm run build`; adapter tests
cover scrubbed tracker defaults, bounded queues, blocked scripts, rejected
promises, privacy signals, development-host suppression and categorical cohorts.
Lifecycle tests cover deduplication, impact-only activation, active checkpoints,
ESC, pagehide/bfcache and repeated rounds. Competitive tests verify failure
categories and async round-context preservation. Browser tests in
[`analytics.spec.ts`](../tests/e2e/analytics.spec.ts) serve local game code under
an intercepted production origin and replace the tracker/backend: they exercise
real desktop/portrait bootstrap, token cleanup, character choice, tutorial skip,
round exit/replay and blocked-tracker boot, without contacting production.
Run `npx playwright test tests/e2e/analytics.spec.ts --workers=1` after installing the configured
Playwright browser with `npx playwright install chromium` (or a local config
pointing at an installed Chrome). These mocks are not live collector verification.
