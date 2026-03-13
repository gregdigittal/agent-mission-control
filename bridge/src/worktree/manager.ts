import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig, WORKTREES_DIR } from '../config.js';
import { audit } from '../audit/logger.js';

// Only allow safe characters in session/agent identifiers
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function validateId(value: string, name: string): void {
  if (!SAFE_ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}: must contain only alphanumeric, underscore, or hyphen characters`);
  }
}

export function getWorktreePath(sessionId: string, agentKey: string): string {
  validateId(sessionId, 'sessionId');
  validateId(agentKey, 'agentKey');
  const result = join(WORKTREES_DIR, `${sessionId}_${agentKey}`);
  // Ensure resolved path is within WORKTREES_DIR
  if (!resolve(result).startsWith(resolve(WORKTREES_DIR))) {
    throw new Error('Path traversal detected in worktree path');
  }
  return result;
}

export async function createWorktree(sessionId: string, agentKey: string): Promise<string> {
  const config = await loadConfig();
  const worktreePath = getWorktreePath(sessionId, agentKey);
  const branchName = `agent/${sessionId.slice(0, 8)}/${agentKey}`;

  if (existsSync(worktreePath)) {
    await audit('worktree_exists', { sessionId, agentKey, path: worktreePath });
    return worktreePath;
  }

  try {
    // Create worktree with a new branch from HEAD
    await execa('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
      cwd: config.repo_path,
    });

    await audit('worktree_created', { sessionId, agentKey, path: worktreePath, branch: branchName });
  } catch (err) {
    // Branch might already exist — try without -b
    try {
      await execa('git', ['worktree', 'add', worktreePath, branchName], {
        cwd: config.repo_path,
      });
      await audit('worktree_created', { sessionId, agentKey, path: worktreePath, branch: branchName });
    } catch (innerErr) {
      await audit('worktree_error', { sessionId, agentKey, error: String(innerErr) });
      throw innerErr;
    }
  }

  return worktreePath;
}

export async function removeWorktree(sessionId: string, agentKey: string): Promise<void> {
  const config = await loadConfig();
  const worktreePath = getWorktreePath(sessionId, agentKey);

  if (!existsSync(worktreePath)) return;

  try {
    await execa('git', ['worktree', 'remove', worktreePath, '--force'], { cwd: config.repo_path });
  } catch {
    // Fallback: manual removal
    await rm(worktreePath, { recursive: true, force: true });
    await execa('git', ['worktree', 'prune'], { cwd: config.repo_path });
  }

  await audit('worktree_removed', { sessionId, agentKey, path: worktreePath });
}

export async function listWorktrees(): Promise<string[]> {
  const config = await loadConfig();
  try {
    const { stdout } = await execa('git', ['worktree', 'list', '--porcelain'], { cwd: config.repo_path });
    return stdout
      .split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.replace('worktree ', ''));
  } catch {
    return [];
  }
}
