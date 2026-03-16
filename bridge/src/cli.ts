#!/usr/bin/env node

/**
 * agent-mc — CLI wrapper for Agent Mission Control bridge operations.
 *
 * Usage:
 *   agent-mc status                    Print bridge heartbeat and agent summary
 *   agent-mc spawn <session> <key>     Spawn a new agent
 *   agent-mc terminate <session> <key> Terminate a running agent
 *   agent-mc log [--tail N]            Stream the latest audit log entries
 *   agent-mc config                    Print the current config (secrets redacted)
 *   agent-mc init <repo-path>          Initialise ~/.agent-mc/ for a repository
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE_DIR = join(homedir(), '.agent-mc');
const STATE_DIR = join(BASE_DIR, 'state');
const COMMANDS_DIR = join(BASE_DIR, 'commands');
const HEARTBEAT_PATH = join(STATE_DIR, 'heartbeat.json');
const DASHBOARD_STATE_PATH = join(STATE_DIR, 'dashboard_state.json');
const TOKEN_PATH = join(BASE_DIR, '.session_token');
const CONFIG_PATH = join(BASE_DIR, 'config.json');
const LOGS_DIR = join(BASE_DIR, 'logs');

// ── Helpers ───────────────────────────────────────────────────────────────────

function usage(): never {
  console.log(`agent-mc <command> [options]

Commands:
  status                      Show bridge heartbeat and agent summary
  spawn <session> <key>       Queue a spawn command
  terminate <session> <key>   Queue a terminate command
  log [--tail N]              Print recent audit log entries (default N=20)
  config                      Print current config (secrets redacted)
  init <repo-path>            Initialise ~/.agent-mc/ for a repository

Options:
  --help, -h                  Show this help
`);
  process.exit(0);
}

function die(msg: string): never {
  console.error(`\u001b[31mError:\u001b[0m ${msg}`);
  process.exit(1);
}

async function readToken(): Promise<string> {
  if (!existsSync(TOKEN_PATH)) die('No session token found. Run: agent-mc init <repo-path>');
  return (await readFile(TOKEN_PATH, 'utf-8')).trim();
}

async function writeCommand(type: string, payload: Record<string, unknown>): Promise<string> {
  const { mkdir, writeFile, rename } = await import('node:fs/promises');
  await mkdir(COMMANDS_DIR, { recursive: true });

  const token = await readToken();
  const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cmd = { id, type, timestamp: new Date().toISOString(), session_token: token, payload };

  const tmpPath = join(COMMANDS_DIR, `${id}.tmp`);
  const finalPath = join(COMMANDS_DIR, `${id}.json`);

  await writeFile(tmpPath, JSON.stringify(cmd, null, 2) + '\n');
  await rename(tmpPath, finalPath);

  return finalPath;
}

function redact(obj: unknown, keys: string[]): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keys.some((r) => k.toLowerCase().includes(r))) {
      out[k] = v ? '***' : v;
    } else if (typeof v === 'object') {
      out[k] = redact(v, keys);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdStatus(): Promise<void> {
  if (!existsSync(HEARTBEAT_PATH)) die('Bridge does not appear to be running (no heartbeat file).');

  const hb = JSON.parse(await readFile(HEARTBEAT_PATH, 'utf-8'));
  const ageSec = ((Date.now() - new Date(hb.ts).getTime()) / 1000).toFixed(0);

  console.log('\u001b[1mBridge Status\u001b[0m');
  console.log(`  Heartbeat:   ${hb.ts} (${ageSec}s ago)`);
  console.log(`  Uptime:      ${Math.floor((hb.uptime ?? 0) / 1000)}s`);
  console.log(`  Loop:        #${hb.loopCount ?? '?'}`);

  if (existsSync(DASHBOARD_STATE_PATH)) {
    const state = JSON.parse(await readFile(DASHBOARD_STATE_PATH, 'utf-8'));
    const sessions = state.sessions ?? [];
    const totalAgents = sessions.reduce((n: number, s: { agents: unknown[] }) => n + s.agents.length, 0);
    console.log(`\n\u001b[1mSessions (${sessions.length})\u001b[0m`);
    for (const session of sessions) {
      console.log(`  [${session.id.slice(0, 8)}] ${session.name} — ${session.agents.length} agent(s), $${(session.totalCost ?? 0).toFixed(4)}`);
      for (const agent of session.agents) {
        const running = agent.status === 'active' ? '\u001b[32m●\u001b[0m' : '\u001b[90m○\u001b[0m';
        console.log(`    ${running} ${agent.key} [${agent.role}] ctx:${agent.ctx}% cost:$${(agent.cost ?? 0).toFixed(4)}`);
      }
    }
    console.log(`\nTotal agents: ${totalAgents}`);
  }
}

async function cmdSpawn(sessionId: string, agentKey: string): Promise<void> {
  if (!sessionId || !agentKey) die('Usage: agent-mc spawn <session-id> <agent-key>');

  const filePath = await writeCommand('spawn_agent', {
    session_id: sessionId,
    agent_key: agentKey,
    role: 'backend',
  });

  console.log(`\u001b[32m✓\u001b[0m Spawn command queued → ${filePath}`);
}

async function cmdTerminate(sessionId: string, agentKey: string): Promise<void> {
  if (!sessionId || !agentKey) die('Usage: agent-mc terminate <session-id> <agent-key>');

  const filePath = await writeCommand('terminate_agent', {
    session_id: sessionId,
    agent_key: agentKey,
    cleanup_worktree: false,
  });

  console.log(`\u001b[32m✓\u001b[0m Terminate command queued → ${filePath}`);
}

async function cmdLog(tail: number): Promise<void> {
  if (!existsSync(LOGS_DIR)) die(`Logs directory not found: ${LOGS_DIR}`);

  const today = new Date().toISOString().slice(0, 10);
  const logPath = join(LOGS_DIR, `audit_${today}.jsonl`);

  if (!existsSync(logPath)) die(`No audit log for today (${today})`);

  const raw = await readFile(logPath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);
  const recent = lines.slice(-tail);

  for (const line of recent) {
    try {
      const entry = JSON.parse(line);
      const ts = new Date(entry.timestamp).toLocaleTimeString();
      const event = `\u001b[36m${entry.event}\u001b[0m`;
      const rest = Object.entries(entry)
        .filter(([k]) => k !== 'timestamp' && k !== 'event')
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ');
      console.log(`${ts} ${event} ${rest}`);
    } catch {
      console.log(line);
    }
  }

  console.log(`\n(${recent.length} of ${lines.length} entries shown — ${logPath})`);
}

async function cmdConfig(): Promise<void> {
  if (!existsSync(CONFIG_PATH)) die(`Config not found: ${CONFIG_PATH}\nRun: agent-mc init <repo-path>`);

  const raw = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  const safe = redact(raw, ['key', 'secret', 'token', 'password']);
  console.log(JSON.stringify(safe, null, 2));
}

async function cmdInit(repoPath: string): Promise<void> {
  if (!repoPath) die('Usage: agent-mc init <repo-path>');

  // Delegate to the main bridge init path
  const { writeDefaultConfig } = await import('./config.js');
  const { mkdir } = await import('node:fs/promises');

  const dirs = [BASE_DIR, COMMANDS_DIR, join(COMMANDS_DIR, '.processed'), STATE_DIR, join(STATE_DIR, 'agents'), LOGS_DIR];
  for (const dir of dirs) await mkdir(dir, { recursive: true });

  await writeDefaultConfig(repoPath);

  const { randomBytes } = await import('node:crypto');
  const { writeFile } = await import('node:fs/promises');
  const token = randomBytes(32).toString('hex');
  await writeFile(TOKEN_PATH, token, { mode: 0o600 });

  console.log(`\u001b[32m✓\u001b[0m Initialised ~/.agent-mc/`);
  console.log(`  Config:  ${CONFIG_PATH}`);
  console.log(`  Token:   ${token.slice(0, 8)}...`);
  console.log(`\nEdit config.json then run: agent-bridge`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    usage();
  }

  const [command, ...rest] = args;

  switch (command) {
    case 'status':
      await cmdStatus();
      break;

    case 'spawn':
      await cmdSpawn(rest[0], rest[1]);
      break;

    case 'terminate':
      await cmdTerminate(rest[0], rest[1]);
      break;

    case 'log': {
      const tailIdx = rest.indexOf('--tail');
      const tail = tailIdx !== -1 ? parseInt(rest[tailIdx + 1] ?? '20', 10) : 20;
      await cmdLog(isNaN(tail) ? 20 : tail);
      break;
    }

    case 'config':
      await cmdConfig();
      break;

    case 'init':
      await cmdInit(rest[0]);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }
}

main().catch((err) => {
  console.error('\u001b[31mFatal:\u001b[0m', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
