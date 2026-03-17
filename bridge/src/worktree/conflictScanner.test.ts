/**
 * Unit tests — bridge: conflict scanner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { scanForConflicts } from './conflictScanner.js';

const mockSpawnSync = spawnSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scanForConflicts', () => {
  it('returns an array of conflicting file paths from git output', async () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: 'src/index.ts\napp/store.ts\n',
      stderr: '',
    });

    const result = await scanForConflicts('/tmp/worktree-1');

    expect(result).toEqual(['src/index.ts', 'app/store.ts']);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', '--diff-filter=U'],
      expect.objectContaining({ cwd: '/tmp/worktree-1' }),
    );
  });

  it('returns an empty array when there are no conflicts (empty stdout)', async () => {
    mockSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const result = await scanForConflicts('/tmp/worktree-2');
    expect(result).toEqual([]);
  });

  it('returns an empty array when git exits with non-zero status', async () => {
    mockSpawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'not a git repository' });

    const result = await scanForConflicts('/tmp/not-a-repo');
    expect(result).toEqual([]);
  });

  it('returns an empty array when spawnSync throws (e.g. git not found)', async () => {
    mockSpawnSync.mockImplementation(() => { throw new Error('spawn git ENOENT'); });

    const result = await scanForConflicts('/tmp/worktree-3');
    expect(result).toEqual([]);
  });

  it('filters out empty lines from git output', async () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: 'src/a.ts\n\nsrc/b.ts\n',
      stderr: '',
    });

    const result = await scanForConflicts('/tmp/worktree-4');
    expect(result).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
