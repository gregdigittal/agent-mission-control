/**
 * Unit tests — bridge: exploration winner selector
 */

import { describe, it, expect, vi } from 'vitest';
import { selectWinner } from './selector.js';
import type { ExploreSession, Approach } from './types.js';

function makeApproach(id: string, status: Approach['status'] = 'running'): Approach {
  return {
    id,
    description: `Approach ${id}`,
    sessionId: 'explore-test',
    agentKey: id,
    worktreePath: `/tmp/wt-${id}`,
    status,
    startedAt: new Date(),
  };
}

function makeSession(overrides: Partial<ExploreSession> = {}): ExploreSession {
  return {
    id: 'explore-test',
    objective: 'Test objective',
    approaches: [makeApproach('approach-0'), makeApproach('approach-1')],
    status: 'running',
    startedAt: new Date(),
    timeoutMs: 30_000,
    ...overrides,
  };
}

describe('selectWinner', () => {
  it('returns null when session is still running with no completed approaches', () => {
    const session = makeSession();
    const result = selectWinner(session);
    expect(result).toBeNull();
  });

  it('returns the completed approach as winner when one approach completes', () => {
    const winner = makeApproach('approach-0', 'completed');
    const loser = makeApproach('approach-1', 'running');
    const session = makeSession({ approaches: [winner, loser], status: 'pending_approval' });

    const result = selectWinner(session);

    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe('approach-0');
    expect(result!.loserIds).toContain('approach-1');
    expect(result!.loserIds).not.toContain('approach-0');
  });

  it('selects the first completed approach when multiple complete simultaneously', () => {
    const a = makeApproach('approach-0', 'completed');
    const b = makeApproach('approach-1', 'completed');
    const session = makeSession({ approaches: [a, b], status: 'pending_approval' });

    const result = selectWinner(session);

    expect(result).not.toBeNull();
    // First completed approach in array order wins ties
    expect(result!.winnerId).toBe('approach-0');
    expect(result!.loserIds).toContain('approach-1');
  });

  it('returns null when session status is cancelled or timeout', () => {
    const cancelled = makeSession({ status: 'cancelled' });
    expect(selectWinner(cancelled)).toBeNull();

    const timedOut = makeSession({ status: 'timeout' });
    expect(selectWinner(timedOut)).toBeNull();
  });

  it('returns null when session is already winner_merged', () => {
    const merged = makeSession({ status: 'winner_merged', winnerId: 'approach-0' });
    expect(selectWinner(merged)).toBeNull();
  });

  it('includes the winnerId and winnerApproach in the result', () => {
    const winner = makeApproach('approach-0', 'completed');
    const session = makeSession({ approaches: [winner], status: 'pending_approval' });

    const result = selectWinner(session);

    expect(result!.winnerApproach).toBe(winner);
    expect(result!.completedAt).toBeInstanceOf(Date);
  });
});
