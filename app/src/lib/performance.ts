/**
 * Performance timing utilities — lightweight wrappers around the Performance API.
 *
 * Collects timing samples in a rolling ring buffer accessible at window.__perfLog.
 * Integrates with the error tracking breadcrumb system to annotate slow operations
 * in captured error events.
 */

import { addBreadcrumb } from './errorTracking';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimingSample {
  name: string;
  durationMs: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface TimingStats {
  count: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p95Ms: number;
}

// ── Internal state ────────────────────────────────────────────────────────────

const MAX_SAMPLES = 200;
/** Threshold above which a timing is logged as a 'warning' breadcrumb. */
const SLOW_THRESHOLD_MS = 500;

const samples: TimingSample[] = [];

// Expose on window for devtools
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__perfLog = samples;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Wraps an async function with timing instrumentation.
 * The result and any thrown errors are passed through unchanged.
 *
 * @example
 * const data = await timed('fetchAgents', () => supabase.from('agents').select('*'));
 */
export async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    record(name, performance.now() - start, tags);
    return result;
  } catch (err) {
    record(name, performance.now() - start, { ...tags, error: 'true' });
    throw err;
  }
}

/**
 * Wraps a synchronous function with timing instrumentation.
 */
export function timedSync<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, string>,
): T {
  const start = performance.now();
  try {
    const result = fn();
    record(name, performance.now() - start, tags);
    return result;
  } catch (err) {
    record(name, performance.now() - start, { ...tags, error: 'true' });
    throw err;
  }
}

/**
 * Returns a mark function; call the returned function to record the elapsed time.
 *
 * @example
 * const finish = startTimer('render');
 * // ... do work ...
 * finish();
 */
export function startTimer(name: string, tags?: Record<string, string>): () => TimingSample {
  const start = performance.now();
  return () => record(name, performance.now() - start, tags);
}

/** Records a timing sample directly (use when you already have the duration). */
export function record(name: string, durationMs: number, tags?: Record<string, string>): TimingSample {
  const sample: TimingSample = { name, durationMs, timestamp: Date.now(), tags };

  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();

  if (durationMs >= SLOW_THRESHOLD_MS) {
    addBreadcrumb({
      category: 'performance',
      message: `Slow: ${name} (${durationMs.toFixed(0)}ms)`,
      level: 'warning',
      data: { durationMs, ...tags },
    });
  }

  return sample;
}

/** Returns all samples matching the given name (most recent first). */
export function getSamples(name?: string): readonly TimingSample[] {
  if (!name) return samples;
  return samples.filter((s) => s.name === name);
}

/** Computes stats for all samples with the given name. Returns null if no samples exist. */
export function getStats(name: string): TimingStats | null {
  const matching = samples.filter((s) => s.name === name).map((s) => s.durationMs);
  if (matching.length === 0) return null;

  const sorted = [...matching].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;

  return {
    count: sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    avgMs: sum / sorted.length,
    p95Ms: sorted[Math.max(0, p95Index)],
  };
}

/** Clears all collected samples (useful in tests). */
export function clearSamples(): void {
  samples.splice(0);
}
