# Gameplay analytics: verified-round baseline

For separate privacy-safe client events (starts, completion, abandonment,
sharing and replay), see [Umami gameplay analytics](ANALYTICS.md). These are
unverified behavioral observations, distinct from the accepted-round totals below.

The gameplay-metrics migration stores **server-recomputed** totals for accepted
Telegram Game rounds only. It does **not** collect pointer coordinates, client
identifiers, user-agent strings, raw traces, or unverified web-practice sessions.
Round IDs join to the existing D1 round table for mode, portrait, finish time,
and score. Target motion remains client-controlled: see
[GOLDEN_MUSTACHE.md](GOLDEN_MUSTACHE.md).

Apply `0005_gameplay_metrics.sql` before deploying the Worker. Historical
records are **not** backfilled with invented hit data. Metrics are inserted
atomically with the accepted score and XP update; duplicate finishes are
idempotent.

## Queries for a baseline

Run the following in a privileged D1 console.

```sql
SELECT r.mode, r.portrait, COUNT(*) AS verified_rounds,
  ROUND(AVG(r.score), 1) AS avg_raw_score,
  ROUND(100.0 * SUM(m.perfect) / NULLIF(SUM(m.shots), 0), 1) AS perfect_pct,
  ROUND(100.0 * SUM(m.perfect + m.good) / NULLIF(SUM(m.shots), 0), 1) AS hit_pct,
  ROUND(AVG(m.shots), 1) AS avg_shots,
  ROUND(AVG(m.golden_pickups), 2) AS avg_gold_pickups
FROM game_round_metrics m
JOIN game_rounds r ON r.id = m.round_id
GROUP BY r.mode, r.portrait
ORDER BY r.mode, r.portrait;
```

```sql
SELECT date(r.finished_at / 1000, 'unixepoch') AS utc_day,
  r.mode, COUNT(*) AS rounds,
  ROUND(AVG(m.max_combo), 1) AS avg_max_combo
FROM game_round_metrics m
JOIN game_rounds r ON r.id = m.round_id
GROUP BY utc_day, r.mode
ORDER BY utc_day DESC LIMIT 40;
```

## Tuning discipline

1. Establish a pre-change baseline separately for mobile/desktop and
   Classic/Gold Rush.
2. Review input and golden-collection observations in playtests. The schema
   counts successful collections, not every visible opportunity. It cannot
   calculate a golden catch **rate** by itself.
3. Test shorter inter-spawn idle time only after baseline data. Reducing
   cooldowns increases the number of scoring opportunities per 45-second round.
   Use a ranked-season boundary or versioned scoring to keep records fair.
4. Keep the current hitboxes and never award valuable prizes from
   client-controlled target timelines. Completion and abandonment measurement
   requires separate, privacy-reviewed start-vs-finish aggregates.
