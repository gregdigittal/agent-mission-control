/**
 * Unit tests — backlogParser.ts
 *
 * Tests cover:
 * - Parses a P0 backlog item correctly
 * - Maps ✅ Done to status 'done'
 * - Maps 🔲 to status 'backlog'
 * - Skips rows marked ❌ Removed
 * - Skips malformed rows without throwing
 * - Returns empty array for empty file
 * - Returns empty array when no table rows are present
 */

import { describe, it, expect, vi } from 'vitest';
import { parseBacklogContent } from './backlogParser.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_BACKLOG = `
# Project Backlog

## Milestone 1

| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| M1-001 | Build scaffold | P0 | M | ✅ Done |
| M1-002 | Add auth | P1 | L | 🔲 |
| M1-003 | Write docs | P2 | S | 🚧 In Progress |
| M1-004 | Old feature | P3 | S | ❌ Removed |

## Milestone 2

| ID | Title | Priority | Effort | Deps | Status |
|----|-------|----------|--------|------|--------|
| M2-001 | API integration | P0 | XL | M1-001 | 🔲 |
`;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('parseBacklogContent — basic parsing', () => {
  it('parses a P0 backlog item correctly', () => {
    const tasks = parseBacklogContent(SAMPLE_BACKLOG);
    const task = tasks.find((t) => t.external_id === 'M1-001');
    expect(task).toBeDefined();
    expect(task!.title).toBe('Build scaffold');
    expect(task!.priority).toBe('P0');
    expect(task!.effort).toBe('M');
    expect(task!.status).toBe('done');
  });

  it('maps ✅ Done to status "done"', () => {
    const tasks = parseBacklogContent(SAMPLE_BACKLOG);
    const task = tasks.find((t) => t.external_id === 'M1-001');
    expect(task!.status).toBe('done');
  });

  it('maps 🔲 to status "backlog"', () => {
    const tasks = parseBacklogContent(SAMPLE_BACKLOG);
    const task = tasks.find((t) => t.external_id === 'M1-002');
    expect(task!.status).toBe('backlog');
  });

  it('maps 🚧 In Progress to status "in_progress"', () => {
    const tasks = parseBacklogContent(SAMPLE_BACKLOG);
    const task = tasks.find((t) => t.external_id === 'M1-003');
    expect(task!.status).toBe('in_progress');
  });

  it('skips rows marked ❌ Removed', () => {
    const tasks = parseBacklogContent(SAMPLE_BACKLOG);
    const removed = tasks.find((t) => t.external_id === 'M1-004');
    expect(removed).toBeUndefined();
  });

  it('parses tasks across multiple milestone tables', () => {
    const tasks = parseBacklogContent(SAMPLE_BACKLOG);
    const task = tasks.find((t) => t.external_id === 'M2-001');
    expect(task).toBeDefined();
    expect(task!.priority).toBe('P0');
    expect(task!.effort).toBe('XL');
    expect(task!.status).toBe('backlog');
  });
});

describe('parseBacklogContent — edge cases', () => {
  it('returns empty array for empty string', () => {
    expect(parseBacklogContent('')).toEqual([]);
  });

  it('returns empty array when no table rows are present', () => {
    const noTable = `# My Project\n\nSome text\n\n- bullet point\n`;
    expect(parseBacklogContent(noTable)).toEqual([]);
  });

  it('skips malformed rows without throwing', () => {
    const malformed = `
| ID | Title | Priority | Status |
|----|-------|----------|--------|
| | missing-id | P1 | 🔲 |
| M3-001 | | P2 | 🔲 |
| not-an-id | valid title | P0 | ✅ Done |
| M3-002 | Good task | P1 | 🔲 |
`;
    let tasks: ReturnType<typeof parseBacklogContent>;
    expect(() => { tasks = parseBacklogContent(malformed); }).not.toThrow();
    // Only M3-002 has a valid ID and title
    expect(tasks!.find((t) => t.external_id === 'M3-002')).toBeDefined();
    expect(tasks!.find((t) => t.external_id === 'not-an-id')).toBeUndefined();
  });

  it('handles a table with no data rows (only header + separator)', () => {
    const headerOnly = `
| ID | Title | Priority | Status |
|----|-------|----------|--------|
`;
    expect(parseBacklogContent(headerOnly)).toEqual([]);
  });

  it('handles ❌ Removed with trailing text', () => {
    const content = `
| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| M1-005 | Removed feature | P2 | S | ❌ Removed (user request) |
`;
    const tasks = parseBacklogContent(content);
    expect(tasks).toHaveLength(0);
  });
});

describe('parseBacklogContent — priority mapping', () => {
  it('maps all priority values correctly', () => {
    const content = `
| ID | Title | Priority | Status |
|----|-------|----------|--------|
| T-001 | Task one | P0 | 🔲 |
| T-002 | Task two | P1 | 🔲 |
| T-003 | Task three | P2 | 🔲 |
| T-004 | Task four | P3 | 🔲 |
| T-005 | No priority | | 🔲 |
`;
    const tasks = parseBacklogContent(content);
    expect(tasks.find((t) => t.external_id === 'T-001')!.priority).toBe('P0');
    expect(tasks.find((t) => t.external_id === 'T-002')!.priority).toBe('P1');
    expect(tasks.find((t) => t.external_id === 'T-003')!.priority).toBe('P2');
    expect(tasks.find((t) => t.external_id === 'T-004')!.priority).toBe('P3');
    expect(tasks.find((t) => t.external_id === 'T-005')!.priority).toBeNull();
  });
});
