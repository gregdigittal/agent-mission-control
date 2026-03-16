import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audit logger to avoid filesystem side effects.
vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// We control the agentProcesses map so we can inject test agents.
vi.mock('./spawn.js', () => ({
  agentProcesses: new Map(),
  spawnAgent: vi.fn().mockResolvedValue(undefined),
}));

// We will mock child_process.spawnSync per-test.
vi.mock('node:child_process');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { SpawnSyncReturns } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { agentProcesses } from './spawn.js';

function makeSpawnSyncSuccess(stdout = ''): SpawnSyncReturns<string> {
  return {
    pid: 1234,
    output: [null, stdout, ''],
    stdout,
    stderr: '',
    status: 0,
    signal: null,
    error: undefined,
  };
}

function makeSpawnSyncFailure(stderr: string): SpawnSyncReturns<string> {
  return {
    pid: 0,
    output: [null, '', stderr],
    stdout: '',
    stderr,
    status: 1,
    signal: null,
    error: undefined,
  };
}

function registerAgent(sessionId: string, worktreePath = '/tmp/test-worktree'): void {
  agentProcesses.set(`${sessionId}:test-agent`, {
    sessionId,
    agentKey: 'test-agent',
    role: 'backend',
    pid: 1111,
    worktreePath,
    running: true,
    startedAt: new Date(),
    lastOutputAt: new Date(),
    restartCount: 0,
  });
}

// ---------------------------------------------------------------------------
// sanitiseBranchName
// ---------------------------------------------------------------------------

describe('sanitiseBranchName()', () => {
  it('lowercases and replaces spaces with hyphens', async () => {
    const { sanitiseBranchName } = await import('./createPr.js');
    expect(sanitiseBranchName('Add Feature X')).toBe('add-feature-x');
  });

  it('replaces special characters with hyphens', async () => {
    const { sanitiseBranchName } = await import('./createPr.js');
    expect(sanitiseBranchName('Fix: bug (critical) #42!')).toBe('fix-bug-critical-42');
  });

  it('collapses multiple non-alphanumeric chars into a single hyphen', async () => {
    const { sanitiseBranchName } = await import('./createPr.js');
    expect(sanitiseBranchName('hello   ---   world')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', async () => {
    const { sanitiseBranchName } = await import('./createPr.js');
    expect(sanitiseBranchName('!leading and trailing!')).toBe('leading-and-trailing');
  });

  it('truncates to 50 characters', async () => {
    const { sanitiseBranchName } = await import('./createPr.js');
    const longTitle = 'a'.repeat(100);
    const result = sanitiseBranchName(longTitle);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('handles a title that is exactly 50 alphanumeric chars without truncation', async () => {
    const { sanitiseBranchName } = await import('./createPr.js');
    const exactly50 = 'a'.repeat(50);
    expect(sanitiseBranchName(exactly50)).toBe(exactly50);
  });
});

// ---------------------------------------------------------------------------
// handleCreatePr
// ---------------------------------------------------------------------------

describe('handleCreatePr()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentProcesses.clear();
  });

  it('returns an error when no agent is found for the sessionId', async () => {
    const { handleCreatePr } = await import('./createPr.js');

    const result = await handleCreatePr({
      sessionId: 'missing-session',
      title: 'My PR',
      body: 'Description',
      baseBranch: 'main',
    });

    expect(result.error).toMatch(/no agent found/i);
    expect(result.prUrl).toBeUndefined();
    // spawnSync should never be called when the session is unknown
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('returns an error without throwing when git checkout fails', async () => {
    registerAgent('sess-checkout-fail');
    vi.mocked(spawnSync).mockReturnValueOnce(
      makeSpawnSyncFailure('already exists'),
    );

    const { handleCreatePr } = await import('./createPr.js');
    const result = await handleCreatePr({
      sessionId: 'sess-checkout-fail',
      title: 'Some Feature',
      body: 'Body',
      baseBranch: 'main',
    });

    expect(result.error).toMatch(/git checkout -b failed/i);
    expect(result.prUrl).toBeUndefined();
  });

  it('returns an error without throwing when git push fails', async () => {
    registerAgent('sess-push-fail');
    // First call: git checkout succeeds
    vi.mocked(spawnSync)
      .mockReturnValueOnce(makeSpawnSyncSuccess())
      // Second call: git push fails
      .mockReturnValueOnce(makeSpawnSyncFailure('remote rejected'));

    const { handleCreatePr } = await import('./createPr.js');
    const result = await handleCreatePr({
      sessionId: 'sess-push-fail',
      title: 'Some Feature',
      body: 'Body',
      baseBranch: 'main',
    });

    expect(result.error).toMatch(/git push failed/i);
    expect(result.prUrl).toBeUndefined();
  });

  it('returns prUrl and branch on a successful end-to-end path', async () => {
    registerAgent('sess-ok');
    vi.mocked(spawnSync)
      .mockReturnValueOnce(makeSpawnSyncSuccess())             // git checkout -b
      .mockReturnValueOnce(makeSpawnSyncSuccess())             // git push
      .mockReturnValueOnce(makeSpawnSyncSuccess('https://github.com/owner/repo/pull/42\n')); // gh pr create

    const { handleCreatePr } = await import('./createPr.js');
    const result = await handleCreatePr({
      sessionId: 'sess-ok',
      title: 'Add awesome feature',
      body: 'This PR adds an awesome feature.',
      baseBranch: 'main',
    });

    expect(result.error).toBeUndefined();
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/42');
    expect(result.branch).toBe('pr/add-awesome-feature');
  });

  it('calls git/gh with array args (no shell interpolation)', async () => {
    registerAgent('sess-args-check');
    vi.mocked(spawnSync)
      .mockReturnValueOnce(makeSpawnSyncSuccess())
      .mockReturnValueOnce(makeSpawnSyncSuccess())
      .mockReturnValueOnce(makeSpawnSyncSuccess('https://github.com/owner/repo/pull/99'));

    const { handleCreatePr } = await import('./createPr.js');
    await handleCreatePr({
      sessionId: 'sess-args-check',
      title: 'Title with spaces & special chars',
      body: 'Body text',
      baseBranch: 'develop',
    });

    const calls = vi.mocked(spawnSync).mock.calls;

    // First call: git checkout -b
    expect(calls[0][0]).toBe('git');
    expect(calls[0][1]).toEqual(['checkout', '-b', 'pr/title-with-spaces-special-chars']);

    // Second call: git push
    expect(calls[1][0]).toBe('git');
    expect(calls[1][1]).toEqual(['push', 'origin', 'HEAD']);

    // Third call: gh pr create — title and body passed as separate array elements
    expect(calls[2][0]).toBe('gh');
    expect(calls[2][1]).toContain('Title with spaces & special chars');
    expect(calls[2][1]).toContain('Body text');
    expect(calls[2][1]).toContain('develop');
  });
});
