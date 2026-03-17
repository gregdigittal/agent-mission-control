/**
 * Unit tests — bridge: parallel exploration competition lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../commands/spawn.js', () => ({
  spawnAgent: vi.fn().mockResolvedValue(undefined),
  agentProcesses: new Map(),
}));

vi.mock('../worktree/manager.js', () => ({
  createWorktree: vi.fn().mockImplementation(
    (_sid: string, agentKey: string) => Promise.resolve(`/tmp/wt-${agentKey}`)
  ),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { startCompetition, pollCompetition, cancelCompetition } from './competition.js';
import { spawnAgent, agentProcesses } from '../commands/spawn.js';
import { removeWorktree } from '../worktree/manager.js';
import type { ExploreSession } from './types.js';

const mockSpawnAgent = spawnAgent as ReturnType<typeof vi.fn>;
const mockRemoveWorktree = removeWorktree as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  (agentProcesses as Map<string, unknown>).clear();
});

// ── startCompetition ───────────────────────────────────────────────────────

describe('startCompetition', () => {
  it('creates a worktree and spawns an agent for each approach', async () => {
    const session = await startCompetition({
      sessionId: 'parent-sess',
      agentKey: 'lead',
      objective: 'Implement auth',
      approaches: ['Use JWT', 'Use sessions'],
      timeoutMs: 60_000,
    });

    expect(session.approaches).toHaveLength(2);
    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(session.status).toBe('running');
  });

  it('assigns distinct sessionIds and agentKeys to each approach', async () => {
    const session = await startCompetition({
      sessionId: 'parent-sess',
      agentKey: 'lead',
      objective: 'Refactor DB layer',
      approaches: ['Approach A', 'Approach B', 'Approach C'],
      timeoutMs: 60_000,
    });

    const agentKeys = session.approaches.map(a => a.agentKey);
    const unique = new Set(agentKeys);
    expect(unique.size).toBe(3);

    const sessionIds = session.approaches.map(a => a.sessionId);
    expect(new Set(sessionIds).size).toBe(1); // all in same explore session
    expect(sessionIds[0]).toMatch(/^explore-/);
  });

  it('sets all approaches to running status on start', async () => {
    const session = await startCompetition({
      sessionId: 'parent-sess',
      agentKey: 'lead',
      objective: 'Build a REST endpoint',
      approaches: ['Option 1', 'Option 2'],
    });

    for (const approach of session.approaches) {
      expect(approach.status).toBe('running');
    }
  });

  it('uses the provided timeoutMs, defaulting to 30 minutes', async () => {
    const withTimeout = await startCompetition({
      sessionId: 's1', agentKey: 'a1', objective: 'x', approaches: ['y'], timeoutMs: 5000,
    });
    expect(withTimeout.timeoutMs).toBe(5000);

    const withDefault = await startCompetition({
      sessionId: 's2', agentKey: 'a2', objective: 'x', approaches: ['y'],
    });
    expect(withDefault.timeoutMs).toBe(30 * 60 * 1000);
  });
});

// ── pollCompetition ────────────────────────────────────────────────────────

describe('pollCompetition', () => {
  it('marks the first completed approach as winner and session as pending_approval', async () => {
    const session = await startCompetition({
      sessionId: 'parent',
      agentKey: 'lead',
      objective: 'Race',
      approaches: ['Fast', 'Slow'],
    });

    const [first, second] = session.approaches;

    // Simulate first approach agent exiting cleanly
    (agentProcesses as Map<string, unknown>).set(`${first.sessionId}:${first.agentKey}`, {
      running: false, exitCode: 0,
    });
    (agentProcesses as Map<string, unknown>).set(`${second.sessionId}:${second.agentKey}`, {
      running: true,
    });

    await pollCompetition(session);

    expect(session.status).toBe('pending_approval');
    expect(session.winnerId).toBe(first.id);
    expect(first.status).toBe('completed');
    expect(second.status).toBe('running');
  });

  it('does not change status when all approaches are still running', async () => {
    const session = await startCompetition({
      sessionId: 'parent',
      agentKey: 'lead',
      objective: 'Still running',
      approaches: ['A', 'B'],
    });

    for (const a of session.approaches) {
      (agentProcesses as Map<string, unknown>).set(`${a.sessionId}:${a.agentKey}`, {
        running: true,
      });
    }

    await pollCompetition(session);

    expect(session.status).toBe('running');
    expect(session.winnerId).toBeUndefined();
  });

  it('marks session as timeout when elapsed time exceeds timeoutMs', async () => {
    const session = await startCompetition({
      sessionId: 'parent',
      agentKey: 'lead',
      objective: 'Slow',
      approaches: ['A'],
      timeoutMs: 5_000,
    });

    // Simulate still running
    const [approach] = session.approaches;
    (agentProcesses as Map<string, unknown>).set(`${approach.sessionId}:${approach.agentKey}`, {
      running: true,
    });

    // Force startedAt far into the past so elapsed always exceeds timeoutMs
    (session as { startedAt: Date }).startedAt = new Date(0);

    await pollCompetition(session);

    expect(session.status).toBe('timeout');
  });
});

// ── cancelCompetition ──────────────────────────────────────────────────────

describe('cancelCompetition', () => {
  it('removes all worktrees and sets status to cancelled', async () => {
    const session = await startCompetition({
      sessionId: 'parent',
      agentKey: 'lead',
      objective: 'Cancel me',
      approaches: ['A', 'B'],
    });

    await cancelCompetition(session);

    expect(mockRemoveWorktree).toHaveBeenCalledTimes(2);
    expect(session.status).toBe('cancelled');
  });
});
