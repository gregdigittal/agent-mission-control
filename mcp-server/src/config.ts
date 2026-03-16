import { homedir } from 'node:os';
import { join } from 'node:path';

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

// Set by bridge when spawning each Claude Code session
export const AGENT_KEY = process.env['AGENT_MC_AGENT_KEY'] ?? 'default';
export const SESSION_ID = process.env['AGENT_MC_SESSION_ID'] ?? 'local';
export const STATE_DIR = process.env['AGENT_MC_STATE_DIR']?.replace('~', homedir())
  ?? join(homedir(), '.agent-mc');

// Derived paths
export const AGENTS_DIR   = join(STATE_DIR, 'state', 'agents');
export const TASKS_FILE   = join(STATE_DIR, 'state', 'tasks.json');
export const AUDIT_FILE   = join(STATE_DIR, 'logs', `audit-${dateTag()}.jsonl`);
export const APPROVALS_DIR = join(STATE_DIR, 'state', 'approvals');
export const INBOX_DIR    = join(STATE_DIR, 'state', 'inbox');

// Budget limits (USD cents) — optionally set by bridge
export const BUDGET_CENTS = Number(process.env['AGENT_MC_BUDGET_CENTS'] ?? '0');

function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}
