import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timed, timedSync, startTimer, record, getSamples, getStats, clearSamples } from './performance';

// Suppress breadcrumb integration noise in tests
vi.mock('./errorTracking', () => ({
  addBreadcrumb: vi.fn(),
}));

beforeEach(() => {
  clearSamples();
});

describe('record', () => {
  it('stores a sample', () => {
    record('op', 100);
    expect(getSamples('op')).toHaveLength(1);
    expect(getSamples('op')[0].durationMs).toBe(100);
  });

  it('stores tags', () => {
    record('op', 50, { source: 'test' });
    expect(getSamples('op')[0].tags?.source).toBe('test');
  });

  it('returns the sample', () => {
    const s = record('op', 42);
    expect(s.durationMs).toBe(42);
    expect(s.name).toBe('op');
  });
});

describe('getSamples', () => {
  it('returns all samples when no name given', () => {
    record('a', 1);
    record('b', 2);
    expect(getSamples()).toHaveLength(2);
  });

  it('filters by name', () => {
    record('a', 1);
    record('b', 2);
    record('a', 3);
    expect(getSamples('a')).toHaveLength(2);
    expect(getSamples('b')).toHaveLength(1);
  });
});

describe('getStats', () => {
  it('returns null when no samples', () => {
    expect(getStats('missing')).toBeNull();
  });

  it('computes min/max/avg correctly', () => {
    record('s', 10);
    record('s', 20);
    record('s', 30);
    const stats = getStats('s')!;
    expect(stats.count).toBe(3);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(30);
    expect(stats.avgMs).toBeCloseTo(20);
  });

  it('computes p95 for a single sample', () => {
    record('s', 42);
    expect(getStats('s')!.p95Ms).toBe(42);
  });
});

describe('timed', () => {
  it('records timing for resolved promise', async () => {
    await timed('fetch', async () => 'ok');
    expect(getSamples('fetch')).toHaveLength(1);
    expect(getSamples('fetch')[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records timing even when promise rejects, then rethrows', async () => {
    await expect(
      timed('failOp', async () => { throw new Error('fail'); }),
    ).rejects.toThrow('fail');
    expect(getSamples('failOp')).toHaveLength(1);
    expect(getSamples('failOp')[0].tags?.error).toBe('true');
  });

  it('passes the resolved value through', async () => {
    const result = await timed('id', async () => 42);
    expect(result).toBe(42);
  });
});

describe('timedSync', () => {
  it('records timing for sync function', () => {
    timedSync('sync', () => 1 + 1);
    expect(getSamples('sync')).toHaveLength(1);
  });

  it('records on throw and rethrows', () => {
    expect(() => timedSync('syncFail', () => { throw new Error('oops'); })).toThrow('oops');
    expect(getSamples('syncFail')[0].tags?.error).toBe('true');
  });
});

describe('startTimer', () => {
  it('records elapsed time when finish is called', async () => {
    const finish = startTimer('manual');
    await new Promise(r => setTimeout(r, 5));
    finish();
    expect(getSamples('manual')).toHaveLength(1);
    expect(getSamples('manual')[0].durationMs).toBeGreaterThan(0);
  });
});

describe('clearSamples', () => {
  it('empties the sample buffer', () => {
    record('x', 1);
    clearSamples();
    expect(getSamples()).toHaveLength(0);
  });
});
