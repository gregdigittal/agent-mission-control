/**
 * Auto-commit module — stages and commits changes in an agent's worktree.
 *
 * Uses `execa` (no shell) to prevent command injection.
 * Called after each bridge loop to checkpoint agent progress.
 *
 * Commit strategy:
 * - Only commits when `git status --porcelain` returns non-empty output
 * - Stages all tracked changes (modified/deleted) — intentionally does NOT
 *   stage untracked files to avoid accidentally committing secrets or build output
 * - Commit message format: `chore(agent): <agentKey> — <task|checkpoint>`
 */

import { execa } from 'execa';
import { audit } from '../audit/logger.js';

// Track last-committed state per worktree to skip no-op cycles
const lastCommitCheck = new Map<string, number>();
const COMMIT_COOLDOWN_MS = 30_000; // at most one auto-commit per 30s per agent

function buildCommitMessage(agentKey: string, task: string): string {
  const sanitizedKey = agentKey.replace(/[^a-zA-Z0-9_\-]/g, '');
  const sanitizedTask = (task || 'checkpoint').slice(0, 72).replace(/[`$]/g, '');
  return `chore(agent): ${sanitizedKey} — ${sanitizedTask}`;
}

/**
 * Commit any staged/modified files in the given worktree.
 *
 * Returns true if a commit was made, false if there was nothing to commit.
 * Never throws — errors are logged and swallowed to avoid crashing the bridge.
 */
export async function autoCommit(
  worktreePath: string,
  agentKey: string,
  task: string,
): Promise<boolean> {
  // Cooldown check — don't spam commits
  const lastCheck = lastCommitCheck.get(worktreePath) ?? 0;
  if (Date.now() - lastCheck < COMMIT_COOLDOWN_MS) return false;
  lastCommitCheck.set(worktreePath, Date.now());

  try {
    // Check for changes (tracked files only — modified, deleted)
    const { stdout: statusOut } = await execa('git', ['status', '--porcelain'], {
      cwd: worktreePath,
    });

    if (!statusOut.trim()) return false; // nothing to commit

    // Stage all tracked modifications (no -A to avoid untracked secrets)
    await execa('git', ['add', '-u'], { cwd: worktreePath });

    // Verify staging actually produced something (add -u is a no-op on untracked-only changes)
    const { stdout: diffOut } = await execa('git', ['diff', '--cached', '--name-only'], {
      cwd: worktreePath,
    });
    if (!diffOut.trim()) return false;

    const message = buildCommitMessage(agentKey, task);

    await execa(
      'git',
      ['commit', '-m', message, '--no-gpg-sign'],
      { cwd: worktreePath },
    );

    await audit('auto_commit', {
      agentKey,
      worktreePath,
      message,
    });

    console.log(`[commit] ${agentKey}: committed checkpoint — "${message.slice(0, 60)}"`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Log at debug level — a commit failure is non-critical
    await audit('auto_commit_error', { agentKey, worktreePath, error: message });
    return false;
  }
}

/**
 * Run auto-commit for all active agent processes.
 * Accepts the agentProcesses map from spawn.ts.
 */
export async function autoCommitAll(
  agents: Map<string, { worktreePath: string; agentKey: string; running: boolean }>,
  agentTasks: Map<string, string>,
): Promise<void> {
  const promises = Array.from(agents.entries())
    .filter(([, agent]) => agent.running)
    .map(([id, agent]) =>
      autoCommit(agent.worktreePath, agent.agentKey, agentTasks.get(id) ?? ''),
    );

  // allSettled — one failure must not block others
  await Promise.allSettled(promises);
}
