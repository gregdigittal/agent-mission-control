import { execa } from 'execa';
import { join } from 'node:path';
import { STATE_DIR } from '../config.js';
import { audit } from '../audit/logger.js';
import type { WorktreeSyncConfig } from '../config.js';

/**
 * Sync a worktree based on the configured strategy.
 *
 * Modes:
 *   - shared_remote: push the worktree's HEAD to a dedicated branch on the shared
 *     remote (`refs/heads/agent/{agentKey}`). The bridge lead can then aggregate
 *     branches via a merge step.
 *   - rsync: copy the bridge state directory (dashboard_state.json, per-agent
 *     state files) to a remote VPS node over SSH. Useful for multi-VPS setups
 *     where the dashboard runs on a different machine.
 *   - none: no-op (default).
 */
export async function syncWorktree(
  agentKey: string,
  worktreePath: string,
  config: WorktreeSyncConfig,
): Promise<void> {
  switch (config.mode) {
    case 'shared_remote':
      await syncSharedRemote(agentKey, worktreePath, config);
      break;
    case 'rsync':
      await syncRsync(agentKey, config);
      break;
    case 'none':
      // Intentional no-op — sync is disabled.
      break;
    default: {
      // Exhaustiveness guard — TypeScript narrows to `never` here if all cases
      // are handled, so this branch is unreachable at runtime.
      const _exhaustive: never = config.mode;
      console.warn(`[worktree/sync] Unknown sync mode: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// shared_remote
// ---------------------------------------------------------------------------

async function syncSharedRemote(
  agentKey: string,
  worktreePath: string,
  config: WorktreeSyncConfig,
): Promise<void> {
  if (!config.shared_remote) {
    console.warn('[worktree/sync] shared_remote mode requires config.worktreeSync.shared_remote to be set');
    return;
  }

  const { remote, baseBranch: _baseBranch } = config.shared_remote;
  const targetRef = `refs/heads/agent/${agentKey}`;

  try {
    await execa('git', ['push', remote, `HEAD:${targetRef}`], {
      cwd: worktreePath,
    });

    await audit('worktree_sync_shared_remote', { agentKey, remote, targetRef });
    console.log(`[worktree/sync] Pushed ${agentKey} → ${remote} ${targetRef}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await audit('worktree_sync_error', { agentKey, mode: 'shared_remote', error: message });
    console.error(`[worktree/sync] shared_remote push failed for ${agentKey}: ${message}`);
    // Non-fatal: sync failure does not halt the main loop.
  }
}

// ---------------------------------------------------------------------------
// rsync
// ---------------------------------------------------------------------------

async function syncRsync(
  agentKey: string,
  config: WorktreeSyncConfig,
): Promise<void> {
  if (!config.rsync) {
    console.warn('[worktree/sync] rsync mode requires config.worktreeSync.rsync to be set');
    return;
  }

  const { remoteHost, remotePath, sshKey } = config.rsync;

  // Build rsync arguments
  const rsyncArgs: string[] = ['-az', '--delete'];

  if (sshKey) {
    rsyncArgs.push('-e', `ssh -i ${sshKey} -o StrictHostKeyChecking=no`);
  }

  // Sync the state directory (dashboard_state.json + per-agent state files)
  const stateSrc = join(STATE_DIR, '/'); // trailing slash = sync contents, not directory itself
  const stateDest = `${remoteHost}:${remotePath}`;

  rsyncArgs.push(stateSrc, stateDest);

  try {
    await execa('rsync', rsyncArgs);
    await audit('worktree_sync_rsync', { agentKey, remoteHost, remotePath });
    console.log(`[worktree/sync] rsync state → ${remoteHost}:${remotePath}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await audit('worktree_sync_error', { agentKey, mode: 'rsync', error: message });
    console.error(`[worktree/sync] rsync failed for ${agentKey}: ${message}`);
    // Non-fatal: sync failure does not halt the main loop.
  }
}
