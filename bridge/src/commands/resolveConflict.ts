/**
 * resolve_conflict command handler.
 *
 * Applies a git merge strategy ('ours', 'theirs', or 'manual') to resolve
 * a conflicting file in an agent's worktree.
 *
 * Security: all git calls use spawnSync with an args array — no shell
 * string interpolation so user-supplied filePath cannot inject commands.
 */

import { spawnSync } from 'node:child_process';

export interface ResolveConflictCommand {
  type: 'resolve_conflict';
  sessionId: string;
  filePath: string;
  strategy: 'ours' | 'theirs' | 'manual';
}

export interface CommandContext {
  agentProcesses: Map<string, { worktreePath: string; agentKey: string }>;
}

export interface CommandResult {
  success: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Handle a resolve_conflict command.
 *
 * Returns a result object — never throws — so the command processor can
 * treat a failed resolution as non-fatal.
 */
export async function handleResolveConflict(
  cmd: ResolveConflictCommand,
  ctx: CommandContext,
): Promise<CommandResult> {
  const agent = ctx.agentProcesses.get(cmd.sessionId);
  if (!agent) {
    return { success: false, error: `Session not found: ${cmd.sessionId}` };
  }

  const { worktreePath } = agent;
  const { filePath, strategy } = cmd;

  // Manual strategy: no git operations — return the path for the operator to edit
  if (strategy === 'manual') {
    return {
      success: true,
      resolvedPath: `${worktreePath}/${filePath}`,
    };
  }

  // strategy: 'ours' | 'theirs'
  const flag = strategy === 'ours' ? '--ours' : '--theirs';

  const checkoutResult = spawnSync('git', ['checkout', flag, filePath], {
    cwd: worktreePath,
    encoding: 'utf-8',
  });

  if (checkoutResult.status !== 0) {
    const error = String(checkoutResult.stderr ?? 'git checkout failed').trim() || 'git checkout failed';
    return { success: false, error };
  }

  const addResult = spawnSync('git', ['add', filePath], {
    cwd: worktreePath,
    encoding: 'utf-8',
  });

  if (addResult.status !== 0) {
    const error = String(addResult.stderr ?? 'git add failed').trim() || 'git add failed';
    return { success: false, error };
  }

  return { success: true };
}

export default handleResolveConflict;
