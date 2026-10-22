import { trackEvent } from './analytics';
import { accuracyPercent, emptyStats, type RoundStats } from '../logic/roundStats';

export type RoundContext = Readonly<{
  layout: 'portrait' | 'landscape';
  mode: 'classic' | 'goldRush';
  character: 'ramin' | 'borhan' | 'mammad';
}>;
type LifecycleEvent =
  | 'menu_view'
  | 'play_click'
  | 'round_start'
  | 'first_shot'
  | 'round_checkpoint'
  | 'round_end'
  | 'round_abandon'
  | 'replay_click';
type Properties = Record<string, string | number | boolean>;
type Emit = (name: LifecycleEvent, props: Properties) => void;

/** Framework-independent, page-local lifecycle. Only confirmed impacts update shot stats.
 * State is committed before calling the optional sink, so failures never retry/duplicate events.
 * Elapsed time comes exclusively from the game's active clock, never browser wall time.
 */
export class RoundAnalytics {
  private roundNumber = 0;
  private context: RoundContext | undefined;
  private active = false;
  private firstImpact = false;
  private checkpoints = new Set<number>();
  private elapsedMs = 0;
  private score = 0;
  private stats: RoundStats = emptyStats;

  constructor(private readonly emit: Emit) {}

  private send(name: LifecycleEvent, props: Properties): void {
    try {
      this.emit(name, props);
    } catch {
      // Analytics must never interrupt gameplay, including an injected callback.
    }
  }

  private contextual(context: RoundContext): Properties {
    return { ...context, round_number: this.roundNumber };
  }

  menuView(context: RoundContext): void {
    this.send('menu_view', this.contextual(context));
  }

  playClick(context: RoundContext): void {
    this.send('play_click', this.contextual(context));
  }

  replayClick(context: RoundContext): void {
    this.send('replay_click', this.contextual(context));
  }

  start(context: RoundContext): void {
    if (this.active) return;
    this.context = { ...context };
    this.roundNumber++;
    this.active = true;
    this.firstImpact = false;
    this.checkpoints.clear();
    this.elapsedMs = 0;
    this.score = 0;
    this.stats = emptyStats;
    this.send('round_start', this.contextual(this.context));
  }

  /** Observe existing aggregate stats; this never implies a shot was fired. */
  update(elapsedMs: number, score: number, stats: RoundStats): void {
    if (!this.active || !this.context) return;
    if (Number.isFinite(elapsedMs)) this.elapsedMs = Math.max(this.elapsedMs, elapsedMs, 0);
    this.score = score;
    this.stats = { ...stats };
    for (const seconds of [15, 30]) {
      if (this.elapsedMs >= seconds * 1000 && !this.checkpoints.has(seconds)) {
        this.checkpoints.add(seconds);
        this.send('round_checkpoint', { ...this.metrics(), checkpoint_seconds: seconds });
      }
    }
  }

  /** Call at projectile impact, after the scoring transaction has committed. */
  impact(elapsedMs: number, score: number, stats: RoundStats): void {
    this.update(elapsedMs, score, stats);
    if (!this.active || this.firstImpact || stats.shots <= 0) return;
    this.firstImpact = true;
    this.send('first_shot', this.metrics());
  }

  finish(reason: 'completed' | 'early_exit'): void {
    this.terminate('round_end', reason);
  }

  abandon(reason: 'shutdown' | 'pagehide'): void {
    this.terminate('round_abandon', reason);
  }

  /** A persisted page is frozen, not abandoned; keep the same round on restoration. */
  pageHide(persisted: boolean): void {
    if (!persisted) this.abandon('pagehide');
  }

  private metrics(): Properties {
    return {
      ...(this.context ? this.contextual(this.context) : {}),
      score: this.score,
      shots: this.stats.shots,
      perfect: this.stats.perfect,
      good: this.stats.good,
      miss: this.stats.misses,
      max_combo: this.stats.maxCombo,
      accuracy: accuracyPercent(this.stats),
      active_elapsed_ms: Math.round(this.elapsedMs),
    };
  }

  private terminate(event: 'round_end' | 'round_abandon', reason: string): void {
    if (!this.active) return;
    this.active = false;
    this.send(event, { ...this.metrics(), reason });
  }
}

/** Shared across scene instances/layout remounts, with no persistent/player identifier. */
export const roundAnalytics = new RoundAnalytics(trackEvent);
