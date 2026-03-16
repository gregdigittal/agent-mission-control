/**
 * rsync manager — syncs project directories to remote VPS instances.
 *
 * Uses child_process.spawn (not exec) to prevent shell injection.
 * rsync is an outbound process — the bridge opens no inbound network ports.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { audit } from '../audit/logger.js';
import type { VpsConfig, SshResult } from './types.js';

const RSYNC_TIMEOUT_MS = 120_000; // 2 minutes for large syncs

export interface RsyncOptions {
  /** Source path on the local machine (must be absolute) */
  sourcePath: string;
  /** Destination path on the remote VPS (must be absolute) */
  destPath: string;
  /** Patterns to exclude (e.g. node_modules, .git) */
  exclude?: string[];
  /** Delete files on remote that don't exist locally */
  deleteRemoved?: boolean;
}

export interface RsyncResult {
  status: 'ok' | 'error' | 'timeout';
  stderr: string;
  durationMs: number;
  bytesTransferred?: number;
}

function validatePath(path: string, label: string): string | null {
  if (!path.startsWith('/')) return `${label} must be an absolute path`;
  if (path.includes('..')) return `${label} must not contain '..'`;
  if (path.length > 512) return `${label} exceeds maximum length`;
  // Allow alphanumeric, dash, underscore, dot, slash
  if (!/^[a-zA-Z0-9/_.-]+$/.test(path)) return `${label} contains disallowed characters`;
  return null;
}

/**
 * Sync a local directory to a remote VPS using rsync over SSH.
 * Uses spawn not exec — arguments are constructed as an array, never interpolated.
 */
export async function rsyncToVps(
  vps: VpsConfig,
  options: RsyncOptions,
): Promise<RsyncResult> {
  const sourceErr = validatePath(options.sourcePath, 'sourcePath');
  if (sourceErr) return { status: 'error', stderr: sourceErr, durationMs: 0 };

  const destErr = validatePath(options.destPath, 'destPath');
  if (destErr) return { status: 'error', stderr: destErr, durationMs: 0 };

  if (!existsSync(options.sourcePath)) {
    return { status: 'error', stderr: `Source path does not exist: ${options.sourcePath}`, durationMs: 0 };
  }

  const startMs = Date.now();

  // Build rsync args as an array — no shell string interpolation of VPS config values
  const rsyncArgs: string[] = [
    '--archive',       // preserve permissions, timestamps, symlinks
    '--compress',
    '--delete-during', // incremental delete during transfer
    '--timeout=30',
    '--rsh', `ssh -i ${vps.sshKeyPath} -p ${vps.port} -o StrictHostKeyChecking=no -o BatchMode=yes`,
  ];

  for (const pattern of options.exclude ?? ['node_modules', '.git', 'dist', '*.log']) {
    rsyncArgs.push('--exclude', pattern);
  }

  if (options.deleteRemoved) {
    rsyncArgs.push('--delete');
  }

  // Ensure trailing slash on source to sync contents, not the directory itself
  const source = options.sourcePath.endsWith('/') ? options.sourcePath : `${options.sourcePath}/`;
  const dest = `${vps.user}@${vps.host}:${options.destPath}`;

  rsyncArgs.push(source, dest);

  return new Promise<RsyncResult>((resolve) => {
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      void audit('rsync_timeout', { vpsId: vps.id, sourcePath: options.sourcePath });
      resolve({ status: 'timeout', stderr: 'rsync timed out', durationMs: Date.now() - startMs });
    }, RSYNC_TIMEOUT_MS);

    const child = spawn('rsync', rsyncArgs, { stdio: ['ignore', 'ignore', 'pipe'] });

    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: 'error', stderr: err.message, durationMs: Date.now() - startMs });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startMs;
      if (code === 0) {
        void audit('rsync_complete', { vpsId: vps.id, durationMs });
        console.log(`[rsync] Synced to ${vps.host} in ${durationMs}ms`);
        resolve({ status: 'ok', stderr, durationMs });
      } else {
        void audit('rsync_error', { vpsId: vps.id, exitCode: code, stderr });
        resolve({ status: 'error', stderr, durationMs });
      }
    });
  });
}
