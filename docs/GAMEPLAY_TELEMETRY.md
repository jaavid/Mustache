# Gameplay analytics: verified-round baseline

The gameplay-metrics migration stores **server-recomputed** totals for accepted Telegram Game rounds only. It does **not** collect any pointer coordinates, client identifiers, user-agent strings, raw traces, or unverified web-practice sessions. Round identifiers join to the existing D1 round table for mode, portrait, finish timestamp and score. The score-integrity limitations in [GOLDEN_MUSTACHE.md](GOLDEN_MUSTACHE.md) still apply: target motion is client controlled.

Migrate `0005_gameplay_metrics.sql` before deploying the Worker. Historical records are **not** backfilled with invented hit data. `game_round_metrics` rows are inserted in the same D1 batch as the accepted score and XP update. Duplicate finishes do not double-count.

## Queries for a baseline (run in a privileged D1 console)

```sql
SELECT r.mode, r.portrait, COUNT(*) AS verified_rounds,
  ROUND(AVG(r.score), 1) AS avg_raw_score,
  ROUND(100.0 * SUM(m.perfect) / NULLIF(SUM(m.shots), 0), 1) AS perfect_pct,
  ROUND(100.0 * SUM(m.perfect + m.good) / NULLIF(SUM(m.shots), 0), 1) AS hit_pct,
  ROUND(AVG(m.shots), 1) AS avg_shots,
  ROUND(AVG(m.golden_pickups), 2) AS avg_gold_pickups
FROM game_round_metrics m JOIN game_rounds r ON r.id = m.round_id
GROUP BY r.mode, r.portrait ORDER BY r.mode, r.portrait;
```

```sql
SELECT date(r.finished_at / 1000, 'unixepoch') AS utc_day,
       r.mode, COUNT(*) AS rounds,
       ROUND(AVG(m.max_combo), 1) AS avg_max_combo
FROM game_round_metrics m JOIN game_rounds r ON r.id = m.round_id
GROUP BY utc_day, r.mode ORDER BY utc_day DESC LIMIT 40;
```

## Tuning discipline

1. Establish a pre-change baseline over real verified rounds, separately for mobile/desktop and Classic/Gold Rush.
2. Review input/drop reports and golden-collection distribution in playtests. The schema counts *successful* collections, not every visible chance, and must not be described as a golden catch **rate**.
3. Test smaller inter-spawn idle time only after baseline data. Shortening cooldowns increases available scoring attempts during 45 seconds and requires a ranked-season boundary or versioned scores.
4. Never inflate hitboxes or award valuable prizes on browser-controlled target timelines. Instrumenting completion/abandonment requires separate, privacy-reviewed start-vs-finish aggregates; this migration intentionally covers accepted rounds only.
