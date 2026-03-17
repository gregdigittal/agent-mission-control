/**
 * Unit tests — bridge: worktree sync module
 *
 * Tests syncWorktree dispatch, syncSharedRemote and syncRsync behaviour
 * (via syncWorktree), and the aggregateBranches helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
}));

vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config.js', () => ({
  STATE_DIR: '/tmp/test-state',
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { execa } from 'execa';
import { syncWorktree, aggregateBranches } from './sync.js';
import type { WorktreeSyncConfig } from '../config.js';

const mockExeca = execa as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── syncWorktree ───────────────────────────────────────────────────────────

describe('syncWorktree — mode: none', () => {
  it('is a no-op and does not call execa', async () => {
    const config: WorktreeSyncConfig = { mode: 'none' };
    await syncWorktree('agent-1', '/tmp/wt-1', config);
    expect(mockExeca).not.toHaveBeenCalled();
  });
});

describe('syncWorktree — mode: shared_remote', () => {
  it('pushes HEAD to refs/heads/agent/<agentKey> on the configured remote', async () => {
    const config: WorktreeSyncConfig = {
      mode: 'shared_remote',
      shared_remote: { remote: 'origin', baseBranch: 'main' },
    };
    await syncWorktree('agent-1', '/tmp/wt-1', config);

    expect(mockExeca).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', 'HEAD:refs/heads/agent/agent-1'],
      expect.objectContaining({ cwd: '/tmp/wt-1' }),
    );
  });

  it('logs a warning and returns early when shared_remote config is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config: WorktreeSyncConfig = { mode: 'shared_remote' };
    await syncWorktree('agent-2', '/tmp/wt-2', config);
    expect(mockExeca).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('shared_remote'));
    warnSpy.mockRestore();
  });

  it('logs an error but does not throw when git push fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExeca.mockRejectedValueOnce(new Error('remote: rejected'));
    const config: WorktreeSyncConfig = {
      mode: 'shared_remote',
      shared_remote: { remote: 'origin', baseBranch: 'main' },
    };
    await expect(syncWorktree('agent-3', '/tmp/wt-3', config)).resolves.toBeUndefined();
    const errorMsg = errorSpy.mock.calls[0]?.[0] as string;
    expect(errorMsg).toContain('shared_remote push failed');
    expect(errorMsg).toContain('remote: rejected');
    errorSpy.mockRestore();
  });
});

describe('syncWorktree — mode: rsync', () => {
  it('calls rsync with -az --delete and the configured remote destination', async () => {
    const config: WorktreeSyncConfig = {
      mode: 'rsync',
      rsync: { remoteHost: 'user@vps.example.com', remotePath: '/srv/amc/state' },
    };
    await syncWorktree('agent-4', '/tmp/wt-4', config);

    expect(mockExeca).toHaveBeenCalledWith(
      'rsync',
      expect.arrayContaining(['-az', '--delete', 'user@vps.example.com:/srv/amc/state']),
    );
  });

  it('includes -e ssh with sshKey when sshKey is configured', async () => {
    const config: WorktreeSyncConfig = {
      mode: 'rsync',
      rsync: { remoteHost: 'user@vps.example.com', remotePath: '/srv/amc/state', sshKey: '/home/user/.ssh/id_rsa' },
    };
    await syncWorktree('agent-4', '/tmp/wt-4', config);

    const [, args] = mockExeca.mock.calls[0] as [string, string[]];
    expect(args).toContain('-e');
    const sshArg = args[args.indexOf('-e') + 1];
    expect(sshArg).toContain('/home/user/.ssh/id_rsa');
  });

  it('logs a warning and returns early when rsync config is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config: WorktreeSyncConfig = { mode: 'rsync' };
    await syncWorktree('agent-5', '/tmp/wt-5', config);
    expect(mockExeca).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rsync'));
    warnSpy.mockRestore();
  });

  it('logs an error but does not throw when rsync fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExeca.mockRejectedValueOnce(new Error('Connection refused'));
    const config: WorktreeSyncConfig = {
      mode: 'rsync',
      rsync: { remoteHost: 'user@vps.example.com', remotePath: '/srv/amc/state' },
    };
    await expect(syncWorktree('agent-6', '/tmp/wt-6', config)).resolves.toBeUndefined();
    const errorMsg = errorSpy.mock.calls[0]?.[0] as string;
    expect(errorMsg).toContain('rsync failed');
    expect(errorMsg).toContain('Connection refused');
    errorSpy.mockRestore();
  });
});

// ── aggregateBranches ──────────────────────────────────────────────────────

describe('aggregateBranches', () => {
  it('returns an empty record for an empty agentKeys array', async () => {
    const result = await aggregateBranches([], '/tmp/repo');
    expect(result).toEqual({});
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('returns commit counts ahead of main for each agent key', async () => {
    mockExeca
      .mockResolvedValueOnce({ stdout: '3\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: '1\n', stderr: '' });

    const result = await aggregateBranches(['agent-1', 'agent-2'], '/tmp/repo');

    expect(result).toEqual({ 'agent-1': 3, 'agent-2': 1 });
    expect(mockExeca).toHaveBeenCalledWith(
      'git',
      ['rev-list', '--count', 'main..agent/agent-1'],
      expect.objectContaining({ cwd: '/tmp/repo' }),
    );
  });

  it('returns 0 for an agent whose branch does not exist (git error)', async () => {
    mockExeca.mockRejectedValueOnce(new Error('unknown revision'));

    const result = await aggregateBranches(['agent-missing'], '/tmp/repo');
    expect(result).toEqual({ 'agent-missing': 0 });
  });

  it('returns 0 when git outputs a non-numeric value', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: 'not-a-number\n', stderr: '' });

    const result = await aggregateBranches(['agent-bad'], '/tmp/repo');
    expect(result['agent-bad']).toBe(0);
  });
});
