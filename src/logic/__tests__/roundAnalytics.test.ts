import { describe, expect, it, vi } from 'vitest';
import { RoundAnalytics, type RoundContext } from '../../platform/roundAnalytics';
import { emptyStats, recordShot } from '../roundStats';

const context: RoundContext = { layout: 'landscape', mode: 'classic', character: 'ramin' };

function setup() {
  const emit = vi.fn();
  return { tracker: new RoundAnalytics(emit), emit };
}

describe('round analytics', () => {
  it('does not start or infer a replay from menu/play intent', () => {
    const { tracker, emit } = setup();
    tracker.menuView(context);
    tracker.playClick({ ...context, mode: 'goldRush' });
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['menu_view', 'play_click']);
    expect(emit.mock.calls[1][1]).toEqual({ ...context, mode: 'goldRush', round_number: 0 });
  });

  it('starts once and records first shot only on confirmed impact (including a miss)', () => {
    const { tracker, emit } = setup();
    tracker.impact(50, 0, recordShot(emptyStats, 'miss', 0));
    tracker.start(context);
    tracker.start(context);
    tracker.update(100, 0, emptyStats);
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['round_start']);
    tracker.impact(200, 0, recordShot(emptyStats, 'miss', 0));
    tracker.impact(400, 100, recordShot(emptyStats, 'good', 1));
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['round_start', 'first_shot']);
    expect(emit.mock.calls[1][1]).toMatchObject({ shots: 1, miss: 1, active_elapsed_ms: 200 });
  });

  it('emits each crossed checkpoint once, including skipped frames, using active time', () => {
    const { tracker, emit } = setup();
    tracker.start(context);
    tracker.update(14999, 0, emptyStats);
    expect(emit).toHaveBeenCalledTimes(1);
    tracker.update(31000, 0, emptyStats);
    tracker.update(31000, 0, emptyStats);
    tracker.update(100, 0, emptyStats);
    expect(emit.mock.calls.slice(1).map(([, props]) => props.checkpoint_seconds)).toEqual([15, 30]);
  });

  it('aggregates existing scoring stats on completion and suppresses all later finish signals', () => {
    const { tracker, emit } = setup();
    tracker.start(context);
    let stats = recordShot(emptyStats, 'perfect', 1);
    stats = recordShot(stats, 'good', 2);
    stats = recordShot(stats, 'miss', 0);
    tracker.update(45000, 260, stats);
    tracker.finish('completed');
    tracker.finish('early_exit');
    tracker.abandon('shutdown');
    tracker.pageHide(false);
    tracker.impact(46000, 999, stats);
    expect(emit.mock.calls.filter(([event]) => event === 'round_end')).toEqual([
      [
        'round_end',
        {
          ...context,
          round_number: 1,
          score: 260,
          shots: 3,
          perfect: 1,
          good: 1,
          miss: 1,
          max_combo: 2,
          accuracy: 67,
          active_elapsed_ms: 45000,
          reason: 'completed',
        },
      ],
    ]);
    expect(emit.mock.calls.some(([event]) => event === 'round_abandon')).toBe(false);
  });

  it('distinguishes ESC early exit from full completion', () => {
    const { tracker, emit } = setup();
    tracker.start(context);
    tracker.update(1200, 0, emptyStats);
    tracker.finish('early_exit');
    expect(emit).toHaveBeenLastCalledWith(
      'round_end',
      expect.objectContaining({
        reason: 'early_exit',
        active_elapsed_ms: 1200,
        accuracy: 0,
      }),
    );
  });

  it('abandons once on pagehide or shutdown and ignores rounds that never started', () => {
    const { tracker, emit } = setup();
    tracker.abandon('shutdown');
    tracker.pageHide(false);
    expect(emit).not.toHaveBeenCalled();
    tracker.start(context);
    tracker.pageHide(false);
    tracker.abandon('shutdown');
    tracker.finish('completed');
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['round_start', 'round_abandon']);
    expect(emit).toHaveBeenLastCalledWith(
      'round_abandon',
      expect.objectContaining({ reason: 'pagehide' }),
    );
  });

  it('preserves bfcache state and first-shot/checkpoint deduplication on restoration', () => {
    const { tracker, emit } = setup();
    tracker.start(context);
    const stats = recordShot(emptyStats, 'perfect', 1);
    tracker.impact(16000, 100, stats);
    tracker.pageHide(true);
    tracker.start(context);
    tracker.impact(17000, 100, stats);
    tracker.finish('completed');
    expect(emit.mock.calls.map(([event]) => event)).toEqual([
      'round_start',
      'round_checkpoint',
      'first_shot',
      'round_end',
    ]);
    expect(emit).toHaveBeenLastCalledWith(
      'round_end',
      expect.objectContaining({ round_number: 1 }),
    );
  });

  it('resets first-shot/checkpoints/stats across repeated rounds and tracks actual replay intent', () => {
    const { tracker, emit } = setup();
    tracker.start(context);
    tracker.impact(31000, 100, recordShot(emptyStats, 'perfect', 1));
    tracker.abandon('shutdown');
    tracker.replayClick(context);
    const next: RoundContext = { layout: 'portrait', mode: 'goldRush', character: 'borhan' };
    tracker.start(next);
    tracker.impact(15000, 0, recordShot(emptyStats, 'miss', 0));
    tracker.finish('early_exit');
    expect(emit.mock.calls.filter(([event]) => event === 'first_shot')).toHaveLength(2);
    expect(emit.mock.calls.filter(([event]) => event === 'round_checkpoint')).toHaveLength(3);
    expect(emit.mock.calls.filter(([event]) => event === 'replay_click')).toHaveLength(1);
    expect(emit).toHaveBeenLastCalledWith(
      'round_end',
      expect.objectContaining({
        ...next,
        round_number: 2,
        score: 0,
        shots: 1,
        perfect: 0,
        miss: 1,
        active_elapsed_ms: 15000,
      }),
    );
  });

  it('contains throwing callbacks without duplicating events or corrupting later rounds', () => {
    const emit = vi.fn().mockImplementation(() => {
      throw new Error('sink unavailable');
    });
    const tracker = new RoundAnalytics(emit);
    expect(() => {
      tracker.menuView(context);
      tracker.playClick(context);
      tracker.start(context);
      tracker.impact(31000, 100, recordShot(emptyStats, 'perfect', 1));
      tracker.finish('completed');
      tracker.abandon('shutdown');
      tracker.replayClick(context);
      tracker.start(context);
      tracker.abandon('shutdown');
    }).not.toThrow();
    expect(emit.mock.calls.filter(([event]) => event === 'round_start')).toHaveLength(2);
    expect(emit.mock.calls.filter(([event]) => event === 'round_end')).toHaveLength(1);
    expect(emit.mock.calls.filter(([event]) => event === 'round_abandon')).toHaveLength(1);
  });
});
