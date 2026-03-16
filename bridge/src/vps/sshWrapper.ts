/**
 * SSH wrapper for remote VPS operations.
 *
 * Security guarantees:
 * - Uses child_process.spawn (never exec) to prevent shell injection
 * - Enforces a command allowlist before executing anything remotely
 * - Validates all arguments against a per-command allowlist pattern
 * - SSH arguments are constructed programmatically — no string interpolation of user input
 * - No network listeners opened on the bridge process — this only dials out
 */

import { spawn } from 'node:child_process';
import type { VpsConfig, RemoteCommand, SshResult, AllowedRemoteCommand } from './types.js';

const SSH_TIMEOUT_MS = 15_000;

// Per-command argument allowlists: each arg must match the associated pattern
const COMMAND_ARG_PATTERNS: Record<AllowedRemoteCommand, RegExp | null> = {
  uptime: null,                            // no args
  df: /^(-h|--human-readable|\/[a-zA-Z0-9/_-]{0,64})$/,
  free: /^(-h|--human|-b|-k|-m|-g|-t|-s|\d+)$/,
  ps: /^(-e|-f|-u|-a|--no-headers|aux|ef|\d+)$/,
  systemctl: /^(status|is-active|is-enabled|show)[a-zA-Z0-9._@-]{0,64}$/,
  journalctl: /^(-u|-n|-f|--since|--no-pager|[a-zA-Z0-9._@-]{1,64}|--output=short)$/,
  cat: /^\/[a-zA-Z0-9/_.-]{1,256}$/,      // absolute paths only, no ..
};

// Additional safety check for 'cat': prevent reading sensitive paths
const BLOCKED_CAT_PATHS = ['/etc/shadow', '/etc/passwd', '/.ssh', '/root/.ssh'];

function validateArgs(command: AllowedRemoteCommand, args: string[]): string | null {
  const pattern = COMMAND_ARG_PATTERNS[command];
  if (pattern === null && args.length > 0) {
    return `Command '${command}' accepts no arguments`;
  }
  if (pattern === null) return null;

  for (const arg of args) {
    if (!pattern.test(arg)) {
      return `Argument '${arg}' is not allowed for command '${command}'`;
    }
    // Extra check for cat: block sensitive paths
    if (command === 'cat' && BLOCKED_CAT_PATHS.some((blocked) => arg.startsWith(blocked))) {
      return `Path '${arg}' is not allowed`;
    }
    // Prevent path traversal
    if (arg.includes('..')) {
      return `Path traversal ('..') is not allowed`;
    }
  }
  return null;
}

/**
 * Run an allowlisted command on a remote VPS via SSH.
 * Uses spawn (not exec) to prevent shell injection.
 */
export async function runSshCommand(
  vps: VpsConfig,
  remote: RemoteCommand,
): Promise<SshResult> {
  const validationError = validateArgs(remote.command, remote.args ?? []);
  if (validationError) {
    return {
      status: 'error',
      stdout: '',
      stderr: validationError,
      exitCode: null,
      durationMs: 0,
    };
  }

  const startMs = Date.now();

  // Build remote command string: command + validated args (no shell interpolation)
  const remoteArgs = [remote.command, ...(remote.args ?? [])].join(' ');

  // SSH arguments constructed programmatically — never string-interpolated from user input
  const sshArgs = [
    '-i', vps.sshKeyPath,
    '-p', String(vps.port),
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'BatchMode=yes',           // Never prompt for passwords
    '-o', `ConnectTimeout=${Math.floor(SSH_TIMEOUT_MS / 1000)}`,
    `${vps.user}@${vps.host}`,
    remoteArgs,
  ];

  return new Promise<SshResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({
        status: 'timeout',
        stdout,
        stderr,
        exitCode: null,
        durationMs: Date.now() - startMs,
      });
    }, SSH_TIMEOUT_MS);

    // spawn — not exec — prevents shell interpretation of arguments
    const child = spawn('ssh', sshArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status: 'error',
        stdout,
        stderr: err.message,
        exitCode: null,
        durationMs: Date.now() - startMs,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const status: SshResult['status'] =
        code === 0 ? 'ok' :
        code === 255 ? 'connection_refused' :
        'error';
      resolve({
        status,
        stdout,
        stderr,
        exitCode: code,
        durationMs: Date.now() - startMs,
      });
    });
  });
}
