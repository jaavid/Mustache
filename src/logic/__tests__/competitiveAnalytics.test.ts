import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/analytics', () => ({ trackEvent: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    location: { search: '?tg_session=' + 'a'.repeat(64), pathname: '/', hash: '' },
    history: { replaceState: vi.fn() },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('categorical competitive analytics', () => {
  it.each([
    [400, 'SCORE_MISMATCH', 'validation'],
    [403, 'DENIED', 'authentication'],
    [500, 'DATABASE_FAILURE', 'server'],
    [503, 'OPERATION_FAILED', 'server'],
    [404, 'NOT_FOUND', 'server'],
  ])('classifies HTTP %i without exporting backend codes', async (status, code, category) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/round/start')
          ? Response.json({ roundId: 'private-round-id' })
          : Response.json({ error: code }, { status }),
      ),
    );
    const { trackEvent } = await import('../../platform/analytics');
    const api = await import('../../platform/competitiveScores');
    api.startCompetitiveRound(true, 'goldRush');
    expect((await api.submitCompetitiveRound(0)).state).toBe('unavailable');
    expect(trackEvent).toHaveBeenCalledWith(
      'score_submit',
      expect.objectContaining({
        outcome: 'unavailable',
        error_category: category,
        layout: 'portrait',
        mode: 'goldRush',
      }),
    );
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(
      /private-round-id|SCORE_MISMATCH|DATABASE_FAILURE|OPERATION_FAILED|NOT_FOUND|DENIED/,
    );
  });

  it('isolates network and invalid JSON failures into network/server categories', async () => {
    const { trackEvent } = await import('../../platform/analytics');
    const api = await import('../../platform/competitiveScores');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Error('PRIVATE NETWORK DETAILS');
      }),
    );
    api.startCompetitiveRound(false);
    await api.submitCompetitiveRound(0);
    expect(trackEvent).toHaveBeenCalledWith(
      'round_start_result',
      expect.objectContaining({ outcome: 'failed', error_category: 'network' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('PRIVATE INVALID RESPONSE', { status: 200 })),
    );
    api.startCompetitiveRound(false);
    await api.submitCompetitiveRound(0);
    expect(trackEvent).toHaveBeenCalledWith(
      'round_start_result',
      expect.objectContaining({ outcome: 'failed', error_category: 'server' }),
    );
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain('PRIVATE');
  });

  it('preserves the originating character/layout/mode when an async score completes after selection changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/round/start')
          ? Response.json({ roundId: 'private-round-id' })
          : Response.json({ telegramState: 'pending', mode: 'goldRush', score: 0 }),
      ),
    );
    const { trackEvent } = await import('../../platform/analytics');
    const { setSelectedCharacter } = await import('../../game/characterChoice');
    const api = await import('../../platform/competitiveScores');
    setSelectedCharacter('borhan');
    api.startCompetitiveRound(true, 'goldRush');
    const pending = api.submitCompetitiveRound(0);
    setSelectedCharacter('mammad');
    expect((await pending).state).toBe('saved');
    expect(trackEvent).toHaveBeenCalledWith(
      'score_submit',
      expect.objectContaining({
        outcome: 'saved',
        character: 'borhan',
        layout: 'portrait',
        mode: 'goldRush',
        telegram_state: 'pending',
      }),
    );
  });

  it('distinguishes local practice without attempting a backend request', async () => {
    window.location.search = '';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { trackEvent } = await import('../../platform/analytics');
    const api = await import('../../platform/competitiveScores');
    api.startCompetitiveRound(false);
    expect((await api.submitCompetitiveRound(0)).state).toBe('local');
    expect(trackEvent).toHaveBeenCalledWith('score_submit', { outcome: 'local' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
