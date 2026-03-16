import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

export const BASE_DIR = join(homedir(), '.agent-mc');
export const COMMANDS_DIR = join(BASE_DIR, 'commands');
export const PROCESSED_DIR = join(COMMANDS_DIR, '.processed');
export const STATE_DIR = join(BASE_DIR, 'state');
export const AGENTS_STATE_DIR = join(STATE_DIR, 'agents');
export const LOGS_DIR = join(BASE_DIR, 'logs');
export const WORKTREES_DIR = join(BASE_DIR, 'worktrees');
export const CONFIG_PATH = join(BASE_DIR, 'config.json');
export const TOKEN_PATH = join(BASE_DIR, '.session_token');
export const HEARTBEAT_PATH = join(STATE_DIR, 'heartbeat.json');
export const DASHBOARD_STATE_PATH = join(STATE_DIR, 'dashboard_state.json');

const RoleSchema = z.object({
  tool_allowlist: z.array(z.string()),
  directory_scope: z.array(z.string()),
});

const WorktreeSyncSchema = z.object({
  mode: z.enum(['shared_remote', 'rsync', 'none']).default('none'),
  rsync: z.object({
    remoteHost: z.string(),
    remotePath: z.string(),
    sshKey: z.string().optional(),
  }).optional(),
  shared_remote: z.object({
    remote: z.string(),
    baseBranch: z.string(),
  }).optional(),
}).default({ mode: 'none' });

export type WorktreeSyncConfig = z.infer<typeof WorktreeSyncSchema>;

const BridgeConfigSchema = z.object({
  loop_interval_ms: z.number().default(2000),
  repo_path: z.string(),
  max_agents: z.number().default(5),
  auto_restart_on_crash: z.boolean().default(true),
  worktreeSync: WorktreeSyncSchema,
  worktree_bootstrap: z.object({
    copy_files: z.array(z.string()).default(['.env', '.env.local']),
    run_commands: z.array(z.string()).default(['npm install --silent']),
  }).default({}),
  supabase: z.object({
    url: z.string().default('https://zpsnbogldtepmfwgqarz.supabase.co'),
    anon_key: z.string().default(''),
    enabled: z.boolean().default(false),
  }).default({}),
  agent_defaults: z.object({
    model: z.string().default('claude-sonnet-4-20250514'),
    max_turns: z.number().default(50),
    tool_allowlist: z.array(z.string()).default(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']),
  }).default({}),
  agent_roles: z.record(z.string(), RoleSchema).default({
    lead: {
      tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task', 'SendMessage'],
      directory_scope: ['/'],
    },
    backend: {
      tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
      directory_scope: ['/app', '/database', '/routes', '/tests'],
    },
    frontend: {
      tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
      directory_scope: ['/src', '/public', '/components', '/tests'],
    },
    reviewer: {
      tool_allowlist: ['Read', 'Grep', 'Glob'],
      directory_scope: ['/'],
    },
  }),
  budget: z.object({
    session_limit_cents: z.number().nullable().default(null),
    agent_limit_cents: z.number().nullable().default(null),
    alert_threshold_pct: z.number().default(80),
  }).default({}),
  webhooks: z.array(z.object({
    /** Unique label for logging/debugging. */
    label: z.string(),
    /** Full URL to POST to on matching events. */
    url: z.string().url(),
    /** Event name glob patterns — e.g. "agent_*", "loop_error", "*". Defaults to all events. */
    events: z.array(z.string()).default(['*']),
    /** HMAC-SHA256 signing secret. If provided, adds an X-Signature-256 header. */
    secret: z.string().optional(),
    /** Request timeout in milliseconds. */
    timeout_ms: z.number().int().min(100).default(5000),
  })).default([]),
  review_loop: z.object({
    /** Maximum times a single agent can be re-queued for review before the loop terminates. */
    max_retries: z.number().int().min(0).default(3),
    /** Prompt appended to each review-loop re-spawn to focus the agent on fixes. */
    retry_prompt_suffix: z.string().default('Please review your previous output and fix any issues found.'),
    /** Whether to auto-trigger a review loop when an agent exits with a non-zero code. */
    auto_review_on_failure: z.boolean().default(false),
  }).default({}),
});

export type BridgeConfig = z.infer<typeof BridgeConfigSchema>;

let cachedConfig: BridgeConfig | null = null;

export async function ensureDirectories(): Promise<void> {
  const dirs = [BASE_DIR, COMMANDS_DIR, PROCESSED_DIR, STATE_DIR, AGENTS_STATE_DIR, LOGS_DIR, WORKTREES_DIR];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

export async function loadConfig(): Promise<BridgeConfig> {
  if (cachedConfig) return cachedConfig;

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config not found at ${CONFIG_PATH}. Run install.sh or create config.json with at minimum: {"repo_path": "/path/to/repo"}`
    );
  }

  const raw = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  cachedConfig = BridgeConfigSchema.parse(raw);
  return cachedConfig;
}

export function reloadConfig(): void {
  cachedConfig = null;
}

export async function writeDefaultConfig(repoPath: string): Promise<void> {
  const config = {
    loop_interval_ms: 2000,
    repo_path: repoPath,
    max_agents: 5,
    auto_restart_on_crash: true,
    worktreeSync: {
      mode: 'none',
    },
    worktree_bootstrap: {
      copy_files: ['.env', '.env.local'],
      run_commands: ['npm install --silent'],
    },
    supabase: {
      url: 'https://zpsnbogldtepmfwgqarz.supabase.co',
      anon_key: '',
      enabled: false,
    },
    agent_defaults: {
      model: 'claude-sonnet-4-20250514',
      max_turns: 50,
      tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    },
    agent_roles: {
      lead: {
        tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task', 'SendMessage'],
        directory_scope: ['/'],
      },
      backend: {
        tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        directory_scope: ['/app', '/database', '/routes', '/tests'],
      },
      frontend: {
        tool_allowlist: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        directory_scope: ['/src', '/public', '/components', '/tests'],
      },
      reviewer: {
        tool_allowlist: ['Read', 'Grep', 'Glob'],
        directory_scope: ['/'],
      },
    },
    budget: {
      session_limit_cents: null,
      agent_limit_cents: null,
      alert_threshold_pct: 80,
    },
  };
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}
