import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = 'a'.repeat(64);

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', {
    location: { search: '?tg_session=' + session, pathname: '/', hash: '' },
    history: { replaceState: vi.fn() },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Telegram score API endpoints', () => {
  it('falls back to the canonical Cloudflare Worker when the custom domain returns 404', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.startsWith('https://mustache.zedai.ir')) {
          return new Response('Not found', { status: 404 });
        }
        if (url.endsWith('/api/round/start')) {
          return Response.json({ roundId: '8ad16fca-e2a3-4f2a-8205-7e8f55d97f18' });
        }
        if (url.endsWith('/api/round/finish')) {
          return Response.json({
            score: 0,
            telegramState: 'pending',
            leaderboard: {
              period: 'week',
              players: [],
              playerCount: 0,
            },
          });
        }
        throw Error('Unknown URL ' + url);
      }),
    );
    const { startCompetitiveRound, submitCompetitiveRound } =
      await import('../../platform/competitiveScores');
    startCompetitiveRound(false);
    const result = await submitCompetitiveRound(0);
    expect(result.state).toBe('saved');
    expect(calls.some((url) => url.includes('mustache.zedai.ir/api/round/start'))).toBe(true);
    expect(
      calls.some((url) => url.includes('n5-mustache-rjttobot.zed-ai.workers.dev/api/round/start')),
    ).toBe(true);
    expect(
      calls.some((url) => url.includes('n5-mustache-rjttobot.zed-ai.workers.dev/api/round/finish')),
    ).toBe(true);
    // Once backup works, do not keep hitting the broken primary for every call.
    expect(calls.filter((url) => url.includes('mustache.zedai.ir')).length).toBe(1);
  });

  it('does not send a score to another backend after server validation rejects it', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.endsWith('/api/round/start')) {
          return Response.json({ roundId: '8ad16fca-e2a3-4f2a-8205-7e8f55d97f18' });
        }
        return Response.json({ error: 'SCORE_MISMATCH' }, { status: 400 });
      }),
    );
    const { startCompetitiveRound, submitCompetitiveRound } =
      await import('../../platform/competitiveScores');
    startCompetitiveRound(true);
    const result = await submitCompetitiveRound(99);
    expect(result.state).toBe('unavailable');
    expect(result.error).toBe('SCORE_MISMATCH');
    expect(calls.some((url) => url.includes('workers.dev'))).toBe(false);
  });
});
