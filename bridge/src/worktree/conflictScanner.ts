/**
 * Conflict scanner — detects unresolved merge conflicts in a git worktree.
 *
 * Uses `git diff --name-only --diff-filter=U` to list files that are in an
 * unmerged (conflicted) state. Non-fatal: any git error returns an empty array.
 */

import { spawnSync } from 'node:child_process';

/**
 * Scan a worktree for unresolved merge conflicts.
 *
 * @returns Array of relative file paths with active conflict markers.
 *          Returns an empty array if the worktree has no conflicts or if
 *          git is unavailable / the path is not a git repository.
 */
export async function scanForConflicts(worktreePath: string): Promise<string[]> {
  try {
    const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
      cwd: worktreePath,
      encoding: 'utf-8',
    });

    if (result.status !== 0) return [];

    const stdout = String(result.stdout ?? '');
    return stdout.split('\n').filter(line => line.trim().length > 0);
  } catch {
    return [];
  }
}
