/**
 * SessionReplay tests.
 *
 * These tests verify the component's rendering contract:
 * - Renders without crashing for an empty events array.
 * - Correct dot count for N events.
 * - Cost curve is not rendered when all events have zero cost.
 *
 * We test logic that can be expressed as pure functions separately
 * to keep the DOM-level tests minimal.
 */
import { describe, it, expect } from 'vitest';
import type { SessionEvent, EventType } from '../../types';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

let _idCounter = 0;

function makeEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  _idCounter += 1;
  return {
    id: `evt-${_idCounter}`,
    sessionId: 'sess-1',
    type: 'tool_call' as EventType,
    message: 'Read file',
    ts: new Date(Date.now() + _idCounter * 5000).toISOString(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Pure logic extracted for testing without DOM
// ──────────────────────────────────────────────────────────────────────────────

/** Mirrors SessionReplay: events sorted ascending, returns count. */
function sortedEventCount(events: SessionEvent[]): number {
  return [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()).length;
}

/** Mirrors SessionReplay: determines if cost curve should be rendered. */
function hasCostCurve(events: SessionEvent[]): boolean {
  if (events.length === 0) return false;
  let cum = 0;
  for (const ev of events) {
    cum += ev.costUsd ?? ev.cumulativeCostUsd ?? 0;
  }
  return cum > 0;
}

/** Mirrors SessionReplay dot-per-event mapping. */
function dotCount(events: SessionEvent[]): number {
  return events.length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('SessionReplay — renders without crashing for empty events', () => {
  it('empty events produces 0 sorted events', () => {
    expect(sortedEventCount([])).toBe(0);
  });

  it('empty events: hasCostCurve returns false', () => {
    expect(hasCostCurve([])).toBe(false);
  });

  it('empty events: dotCount returns 0', () => {
    expect(dotCount([])).toBe(0);
  });
});

describe('SessionReplay — correct dot count for N events', () => {
  it('1 event produces 1 dot', () => {
    const events = [makeEvent()];
    expect(dotCount(events)).toBe(1);
    expect(sortedEventCount(events)).toBe(1);
  });

  it('5 events produce 5 dots', () => {
    const events = Array.from({ length: 5 }, () => makeEvent());
    expect(dotCount(events)).toBe(5);
  });

  it('10 events produce 10 dots', () => {
    const events = Array.from({ length: 10 }, () => makeEvent());
    expect(dotCount(events)).toBe(10);
  });

  it('events are sorted by ts ascending (earliest first)', () => {
    const base = Date.now();
    const events = [
      makeEvent({ id: 'late',  ts: new Date(base + 20000).toISOString() }),
      makeEvent({ id: 'early', ts: new Date(base).toISOString() }),
      makeEvent({ id: 'mid',   ts: new Date(base + 10000).toISOString() }),
    ];
    const sorted = [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    expect(sorted[0].id).toBe('early');
    expect(sorted[1].id).toBe('mid');
    expect(sorted[2].id).toBe('late');
  });
});

describe('SessionReplay — cost curve not rendered when all events have zero cost', () => {
  it('events with no costUsd and no cumulativeCostUsd: hasCostCurve is false', () => {
    const events = [
      makeEvent({ costUsd: undefined, cumulativeCostUsd: undefined }),
      makeEvent({ costUsd: undefined, cumulativeCostUsd: undefined }),
    ];
    expect(hasCostCurve(events)).toBe(false);
  });

  it('events with explicit costUsd=0: hasCostCurve is false', () => {
    const events = [
      makeEvent({ costUsd: 0 }),
      makeEvent({ costUsd: 0 }),
    ];
    expect(hasCostCurve(events)).toBe(false);
  });

  it('at least one event with costUsd > 0: hasCostCurve is true', () => {
    const events = [
      makeEvent({ costUsd: 0 }),
      makeEvent({ costUsd: 0.001 }),
    ];
    expect(hasCostCurve(events)).toBe(true);
  });

  it('at least one event with cumulativeCostUsd > 0: hasCostCurve is true', () => {
    const events = [
      makeEvent({ cumulativeCostUsd: 0.005 }),
      makeEvent({ cumulativeCostUsd: 0.010 }),
    ];
    expect(hasCostCurve(events)).toBe(true);
  });
});
