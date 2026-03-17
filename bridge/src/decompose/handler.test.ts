/**
 * Unit tests — bridge: decompose handler
 *
 * Tests the handleDecomposeObjective function, focusing on:
 *   - Empty subtask list is a no-op
 *   - Linear chain (A → B → C) is processed in dependency order
 *   - Independent tasks (A, B) are dispatched in the same batch before C
 *   - Assignment failure (assignTask returns null) does not halt processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('./decompose.js', () => ({
  decompose: vi.fn(),
}));

vi.mock('../assign/assigner.js', () => ({
  assignTask: vi.fn().mockResolvedValue(null),
}));

vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../commands/spawn.js', () => ({
  agentProcesses: new Map([
    ['sess:agent-1', { sessionId: 'sess', agentKey: 'agent-1', role: 'backend', running: true }],
  ]),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { handleDecomposeObjective } from './handler.js';
import { decompose } from './decompose.js';
import { assignTask } from '../assign/assigner.js';
import { audit } from '../audit/logger.js';

const mockDecompose = decompose as ReturnType<typeof vi.fn>;
const mockAssignTask = assignTask as ReturnType<typeof vi.fn>;
const mockAudit = audit as ReturnType<typeof vi.fn>;

function makeSubtask(id: string, dependsOn: string[] = []) {
  return { id, title: `Task ${id}`, description: `Do ${id}`, estimatedTurns: 2, dependsOn };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAssignTask.mockResolvedValue(null);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('handleDecomposeObjective — empty subtask list', () => {
  it('returns an empty result without calling assignTask', async () => {
    mockDecompose.mockResolvedValue({ subtasks: [], rawResponse: '' });

    const result = await handleDecomposeObjective({
      objective: 'Do nothing',
      sessionId: 'sess-1',
      agentKey: 'lead',
    });

    expect(result.subtasks).toHaveLength(0);
    expect(mockAssignTask).not.toHaveBeenCalled();
  });
});

describe('handleDecomposeObjective — linear dependency chain', () => {
  it('processes A before B and B before C in a three-task linear chain', async () => {
    const taskA = makeSubtask('A', []);
    const taskB = makeSubtask('B', ['A']);
    const taskC = makeSubtask('C', ['B']);
    mockDecompose.mockResolvedValue({ subtasks: [taskA, taskB, taskC], rawResponse: '' });

    // Track registration order via audit calls for 'subtask_registered'
    const registered: string[] = [];
    mockAudit.mockImplementation((event: string, data: Record<string, unknown>) => {
      if (event === 'subtask_registered') registered.push(data['subtaskId'] as string);
      return Promise.resolve();
    });

    await handleDecomposeObjective({ objective: 'Chain', sessionId: 'sess-2', agentKey: 'lead' });

    expect(registered).toEqual(['A', 'B', 'C']);
  });
});

describe('handleDecomposeObjective — parallel batch dispatch', () => {
  it('processes A and B in the same batch before processing C (which depends on both)', async () => {
    const taskA = makeSubtask('A', []);
    const taskB = makeSubtask('B', []);
    const taskC = makeSubtask('C', ['A', 'B']);
    mockDecompose.mockResolvedValue({ subtasks: [taskA, taskB, taskC], rawResponse: '' });

    const registered: string[] = [];
    mockAudit.mockImplementation((event: string, data: Record<string, unknown>) => {
      if (event === 'subtask_registered') registered.push(data['subtaskId'] as string);
      return Promise.resolve();
    });

    await handleDecomposeObjective({ objective: 'Parallel', sessionId: 'sess-3', agentKey: 'lead' });

    // A and B must both be registered before C
    const indexA = registered.indexOf('A');
    const indexB = registered.indexOf('B');
    const indexC = registered.indexOf('C');

    expect(indexA).toBeLessThan(indexC);
    expect(indexB).toBeLessThan(indexC);
    // A and B should appear in the first two positions (same batch)
    expect(indexA).toBeLessThanOrEqual(1);
    expect(indexB).toBeLessThanOrEqual(1);
  });

  it('assignTask is called for all subtasks including those in the same batch', async () => {
    const taskA = makeSubtask('A', []);
    const taskB = makeSubtask('B', []);
    mockDecompose.mockResolvedValue({ subtasks: [taskA, taskB], rawResponse: '' });

    await handleDecomposeObjective({ objective: 'Two tasks', sessionId: 'sess-4', agentKey: 'lead' });

    expect(mockAssignTask).toHaveBeenCalledTimes(2);
  });
});

describe('handleDecomposeObjective — assignment failure tolerance', () => {
  it('continues processing all subtasks even when assignTask returns null for some', async () => {
    const taskA = makeSubtask('A', []);
    const taskB = makeSubtask('B', []);
    mockDecompose.mockResolvedValue({ subtasks: [taskA, taskB], rawResponse: '' });
    // assignTask returns null (no agent available) — should not halt processing
    mockAssignTask.mockResolvedValue(null);

    const registered: string[] = [];
    mockAudit.mockImplementation((event: string, data: Record<string, unknown>) => {
      if (event === 'subtask_registered') registered.push(data['subtaskId'] as string);
      return Promise.resolve();
    });

    await expect(
      handleDecomposeObjective({ objective: 'No agents', sessionId: 'sess-5', agentKey: 'lead' })
    ).resolves.not.toThrow();

    expect(registered).toContain('A');
    expect(registered).toContain('B');
  });

  it('continues processing dependent tasks even when a dependency assignment fails', async () => {
    const taskA = makeSubtask('A', []);
    const taskB = makeSubtask('B', ['A']); // B depends on A
    mockDecompose.mockResolvedValue({ subtasks: [taskA, taskB], rawResponse: '' });

    const registered: string[] = [];
    mockAudit.mockImplementation((event: string, data: Record<string, unknown>) => {
      if (event === 'subtask_registered') registered.push(data['subtaskId'] as string);
      return Promise.resolve();
    });

    await handleDecomposeObjective({ objective: 'Dep failure', sessionId: 'sess-6', agentKey: 'lead' });

    // Both A and B must be registered even though A's assignment returned null
    expect(registered).toContain('A');
    expect(registered).toContain('B');
  });
});
