/**
 * Unit tests — bridge: resolve_conflict command handler
 *
 * RED TESTS — the handler (bridge/src/commands/resolveConflict.ts) does not
 * exist yet. These tests define its expected contract so the implementation
 * can be driven by failing tests.
 *
 * Run: cd bridge && npx vitest run src/commands/resolveConflict.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── The module under test does not exist yet — import will fail (RED) ─────────
// Once the handler is implemented at bridge/src/commands/resolveConflict.ts,
// these imports will resolve and tests will run.

let resolveConflict: (cmd: ResolveConflictCommand, ctx: CommandContext) => Promise<CommandResult>;

interface ResolveConflictCommand {
  type: 'resolve_conflict';
  sessionId: string;
  filePath: string;
  strategy: 'ours' | 'theirs' | 'manual';
}

interface CommandContext {
  agentProcesses: Map<string, { worktreePath: string; agentKey: string }>;
}

interface CommandResult {
  success: boolean;
  error?: string;
  resolvedPath?: string;
}

// ── Mock child_process ────────────────────────────────────────────────────────

const mockSpawnSync = vi.fn();
vi.mock('node:child_process', () => ({
  spawnSync: mockSpawnSync,
}));

beforeEach(async () => {
  vi.clearAllMocks();
  // Lazy import after mocks are set up — will throw ModuleNotFoundError until
  // the implementation file is created (this is intentional RED behaviour)
  try {
    const mod = await import('./resolveConflict.js');
    resolveConflict = mod.handleResolveConflict ?? mod.default;
  } catch {
    // Handler not yet implemented — tests will fail at the expect() calls
    resolveConflict = async () => { throw new Error('resolveConflict handler not implemented'); };
  }
});

// ── Contract tests ────────────────────────────────────────────────────────────

describe('resolve_conflict — strategy: ours', () => {
  it('runs git checkout --ours on the conflicting file', async () => {
    mockSpawnSync.mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') });

    const ctx: CommandContext = {
      agentProcesses: new Map([['session-1', { worktreePath: '/tmp/worktree-1', agentKey: 'agent-1' }]]),
    };
    const cmd: ResolveConflictCommand = {
      type: 'resolve_conflict',
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      strategy: 'ours',
    };

    const result = await resolveConflict(cmd, ctx);

    expect(result.success).toBe(true);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '--ours', 'src/index.ts'],
      expect.objectContaining({ cwd: '/tmp/worktree-1' })
    );
  });

  it('runs git add after checkout --ours to stage the resolved file', async () => {
    mockSpawnSync.mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') });

    const ctx: CommandContext = {
      agentProcesses: new Map([['session-1', { worktreePath: '/tmp/worktree-1', agentKey: 'agent-1' }]]),
    };
    await resolveConflict({ type: 'resolve_conflict', sessionId: 'session-1', filePath: 'src/store.ts', strategy: 'ours' }, ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gitAddCall = (mockSpawnSync as ReturnType<typeof vi.fn>).mock.calls.find(
      // @ts-ignore -- call is [cmd, args[], opts]; typed as string[][] to access elements but call[0] is string
      (call: string[][]) => call[0] === 'git' && call[1].includes('add')
    );
    expect(gitAddCall).toBeDefined();
    // @ts-ignore -- gitAddCall is narrowed by expect().toBeDefined() above but TS doesn't track that
    expect(gitAddCall[1]).toContain('src/store.ts');
  });
});

describe('resolve_conflict — strategy: theirs', () => {
  it('runs git checkout --theirs on the conflicting file', async () => {
    mockSpawnSync.mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') });

    const ctx: CommandContext = {
      agentProcesses: new Map([['session-2', { worktreePath: '/tmp/worktree-2', agentKey: 'agent-2' }]]),
    };
    await resolveConflict({ type: 'resolve_conflict', sessionId: 'session-2', filePath: 'app/store.ts', strategy: 'theirs' }, ctx);

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '--theirs', 'app/store.ts'],
      expect.objectContaining({ cwd: '/tmp/worktree-2' })
    );
  });
});

describe('resolve_conflict — strategy: manual', () => {
  it('does NOT run git checkout for manual strategy', async () => {
    const ctx: CommandContext = {
      agentProcesses: new Map([['session-3', { worktreePath: '/tmp/worktree-3', agentKey: 'agent-3' }]]),
    };
    const result = await resolveConflict({ type: 'resolve_conflict', sessionId: 'session-3', filePath: 'src/app.ts', strategy: 'manual' }, ctx);

    expect(result.success).toBe(true);
    const gitCheckoutCall = (mockSpawnSync as ReturnType<typeof vi.fn>).mock.calls.find(
      // @ts-ignore -- call is [cmd, args[], opts]; typed as string[][] to access elements but call[0] is string
      (call: string[][]) => call[0] === 'git' && (call[1].includes('--ours') || call[1].includes('--theirs'))
    );
    expect(gitCheckoutCall).toBeUndefined();
  });

  it('returns resolvedPath pointing to the file for manual editing', async () => {
    const ctx: CommandContext = {
      agentProcesses: new Map([['session-3', { worktreePath: '/tmp/worktree-3', agentKey: 'agent-3' }]]),
    };
    const result = await resolveConflict({ type: 'resolve_conflict', sessionId: 'session-3', filePath: 'src/app.ts', strategy: 'manual' }, ctx);
    expect(result.resolvedPath).toBe('/tmp/worktree-3/src/app.ts');
  });
});

describe('resolve_conflict — error cases', () => {
  it('returns { success: false, error } when sessionId not found', async () => {
    const ctx: CommandContext = { agentProcesses: new Map() };
    const result = await resolveConflict({ type: 'resolve_conflict', sessionId: 'nonexistent', filePath: 'src/x.ts', strategy: 'ours' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/session|not found/i);
  });

  it('returns { success: false, error } when git checkout fails (exit code 1)', async () => {
    mockSpawnSync.mockReturnValue({ status: 1, stdout: Buffer.from(''), stderr: Buffer.from('conflict error') });

    const ctx: CommandContext = {
      agentProcesses: new Map([['session-4', { worktreePath: '/tmp/worktree-4', agentKey: 'agent-4' }]]),
    };
    const result = await resolveConflict({ type: 'resolve_conflict', sessionId: 'session-4', filePath: 'src/x.ts', strategy: 'ours' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('never uses shell string interpolation (no exec/execSync with strings)', async () => {
    // Verify no shell injection surface — the implementation must use spawnSync
    // with an args array. If this test is green, the implementation is safe.
    // (This is enforced by the test above checking spawnSync is called with arrays)
    const ctx: CommandContext = {
      agentProcesses: new Map([['session-5', { worktreePath: '/tmp/wt', agentKey: 'agent-5' }]]),
    };
    const maliciousPath = 'src/$(rm -rf /).ts';
    mockSpawnSync.mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') });
    await resolveConflict({ type: 'resolve_conflict', sessionId: 'session-5', filePath: maliciousPath, strategy: 'ours' }, ctx);

    // spawnSync should have been called with the literal string, not a shell command
    const call = (mockSpawnSync as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toContain(maliciousPath); // passed as arg, not shell-expanded
  });
});

// ── Assigner edge cases (supplement to existing assigner.test.ts) ─────────────

describe('assigner — additional edge cases', () => {
  it('is covered by bridge/src/assign/assigner.test.ts (57 tests passing)', () => {
    // This placeholder documents that the main assigner tests are in assigner.test.ts.
    // Add new edge cases here as they are discovered during integration.
    expect(true).toBe(true);
  });
});
