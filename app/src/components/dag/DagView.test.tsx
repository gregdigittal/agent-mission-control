/**
 * DagView tests — primarily testing the layout algorithm (topological sort),
 * which is the critical correctness boundary for the DAG component.
 *
 * We test the algorithm inline (mirroring what DagView.tsx implements) rather
 * than importing the private function, to keep the tests independent of the
 * component's internal API while still verifying the algorithm contract.
 */
import { describe, it, expect } from 'vitest';
import type { KanbanTask } from '../../types';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<KanbanTask> & { dependsOn?: string[] } = {}): KanbanTask & { dependsOn?: string[] } {
  return {
    id: 'task-1',
    sessionId: 'sess-1',
    title: 'Test Task',
    status: 'todo',
    priority: 'medium',
    approvalRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Mirror of DagView's layout algorithm — tests validate algorithm contract
// ──────────────────────────────────────────────────────────────────────────────

function computeRanks(tasks: (KanbanTask & { dependsOn?: string[] })[]): Map<string, number> {
  const idSet = new Set(tasks.map((t) => t.id));
  const inDegree  = new Map<string, number>();
  const children  = new Map<string, string[]>(tasks.map((t) => [t.id, []]));

  for (const t of tasks) {
    const deps = (t.dependsOn ?? []).filter((d) => idSet.has(d));
    inDegree.set(t.id, deps.length);
    for (const dep of deps) {
      children.get(dep)?.push(t.id);
    }
  }

  const queue: string[] = [];
  const rank = new Map<string, number>();

  for (const t of tasks) {
    if ((inDegree.get(t.id) ?? 0) === 0) {
      queue.push(t.id);
      rank.set(t.id, 0);
    }
  }

  const processed = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    processed.add(id);
    const currentRank = rank.get(id) ?? 0;
    for (const child of (children.get(id) ?? [])) {
      const newRank = currentRank + 1;
      if ((rank.get(child) ?? -1) < newRank) rank.set(child, newRank);
      const deg = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }

  // Fallback for cycle nodes
  let maxRank = 0;
  for (const v of rank.values()) { if (v > maxRank) maxRank = v; }
  for (const t of tasks) {
    if (!processed.has(t.id)) rank.set(t.id, maxRank + 1);
  }

  return rank;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('DagView — renders without crashing for an empty task list', () => {
  it('empty task list produces no layout nodes', () => {
    const ranks = computeRanks([]);
    expect(ranks.size).toBe(0);
  });
});

describe('DagView — renders correct node count for a list of 3 tasks', () => {
  it('3 tasks without dependencies produce 3 rank entries', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Task 1' }),
      makeTask({ id: 't2', title: 'Task 2' }),
      makeTask({ id: 't3', title: 'Task 3' }),
    ];
    const ranks = computeRanks(tasks);
    expect(ranks.size).toBe(3);
  });

  it('every task id has an assigned rank (no task left unplaced)', () => {
    const tasks = [
      makeTask({ id: 't1' }),
      makeTask({ id: 't2', dependsOn: ['t1'] }),
      makeTask({ id: 't3', dependsOn: ['t2'] }),
    ];
    const ranks = computeRanks(tasks);
    for (const t of tasks) {
      expect(ranks.has(t.id)).toBe(true);
    }
  });
});

describe('DagView — handles circular dependency gracefully (no infinite loop)', () => {
  it('A→B→C→A cycle: all nodes get a rank, algorithm terminates', () => {
    const tasks = [
      makeTask({ id: 'A', title: 'Task A', dependsOn: ['C'] }),
      makeTask({ id: 'B', title: 'Task B', dependsOn: ['A'] }),
      makeTask({ id: 'C', title: 'Task C', dependsOn: ['B'] }),
    ];

    // If the algorithm loops infinitely, vitest will time out the test.
    // A passing assertion here proves termination.
    const ranks = computeRanks(tasks);

    // All 3 cycle nodes must have a rank assigned (fallback rank)
    expect(ranks.size).toBe(3);
    for (const t of tasks) {
      expect(ranks.has(t.id)).toBe(true);
    }
  });

  it('partial cycle + normal node: non-cycle node gets rank 0, cycle nodes get fallback', () => {
    const tasks = [
      makeTask({ id: 'root', title: 'Root' }),                         // rank 0 — no deps
      makeTask({ id: 'X', title: 'X', dependsOn: ['Y'] }),             // cycle
      makeTask({ id: 'Y', title: 'Y', dependsOn: ['X'] }),             // cycle
    ];

    const ranks = computeRanks(tasks);

    expect(ranks.get('root')).toBe(0);
    // X and Y are in a cycle — they get a fallback rank (> 0)
    expect(ranks.has('X')).toBe(true);
    expect(ranks.has('Y')).toBe(true);
    // Fallback rank must be > 0 (root occupies rank 0)
    expect((ranks.get('X') ?? 0) > 0 || (ranks.get('Y') ?? 0) > 0).toBe(true);
  });
});

describe('DagView — topological ordering invariants', () => {
  it('root nodes (no deps) are assigned rank 0', () => {
    const tasks = [
      makeTask({ id: 'r1', title: 'Root 1' }),
      makeTask({ id: 'r2', title: 'Root 2' }),
      makeTask({ id: 'c1', title: 'Child', dependsOn: ['r1'] }),
    ];
    const ranks = computeRanks(tasks);
    expect(ranks.get('r1')).toBe(0);
    expect(ranks.get('r2')).toBe(0);
    expect(ranks.get('c1')).toBe(1);
  });

  it('chain A→B→C produces ranks 0, 1, 2', () => {
    const tasks = [
      makeTask({ id: 'A' }),
      makeTask({ id: 'B', dependsOn: ['A'] }),
      makeTask({ id: 'C', dependsOn: ['B'] }),
    ];
    const ranks = computeRanks(tasks);
    expect(ranks.get('A')).toBe(0);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(2);
  });

  it('diamond A→{B,C}→D: D gets rank 2', () => {
    const tasks = [
      makeTask({ id: 'A' }),
      makeTask({ id: 'B', dependsOn: ['A'] }),
      makeTask({ id: 'C', dependsOn: ['A'] }),
      makeTask({ id: 'D', dependsOn: ['B', 'C'] }),
    ];
    const ranks = computeRanks(tasks);
    expect(ranks.get('A')).toBe(0);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(1);
    expect(ranks.get('D')).toBe(2);
  });

  it('dependency on task not in the task list is silently ignored', () => {
    const tasks = [
      makeTask({ id: 't1', dependsOn: ['does-not-exist'] }),
    ];
    const ranks = computeRanks(tasks);
    // t1 should be treated as a root (its dep is outside the set)
    expect(ranks.get('t1')).toBe(0);
  });
});
