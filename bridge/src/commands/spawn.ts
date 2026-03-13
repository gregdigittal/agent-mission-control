import { execa } from 'execa';
import { loadConfig } from '../config.js';
import { getPermissionsForRole, buildAllowedToolsArg } from '../security/permissions.js';
import { createWorktree } from '../worktree/manager.js';
import { bootstrapEnvironment } from '../worktree/bootstrap.js';
import { audit } from '../audit/logger.js';
import type { AgentProcess } from '../health/checker.js';

// In-memory registry of active agent processes
export const agentProcesses = new Map<string, AgentProcess>();

export interface SpawnPayload {
  session_id: string;
  agent_key: string;
  role: string;
  prompt?: string;
  model?: string;
  max_turns?: number;
  env_vars?: Record<string, string>;
}

function agentId(sessionId: string, agentKey: string): string {
  return `${sessionId}:${agentKey}`;
}

export function filterEnv(allowed?: Record<string, string>): NodeJS.ProcessEnv {
  // Start with minimal safe env
  const env: NodeJS.ProcessEnv = {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    SHELL: process.env.SHELL,
    USER: process.env.USER,
    LANG: process.env.LANG,
    TERM: process.env.TERM,
    // Claude Code needs these
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLAUDE_CODE_MAX_TURNS: undefined,
  };

  // Merge any explicitly passed env vars
  if (allowed) {
    Object.assign(env, allowed);
  }

  return env;
}

export async function spawnAgent(payload: SpawnPayload): Promise<void> {
  const config = await loadConfig();
  const id = agentId(payload.session_id, payload.agent_key);

  // Check if already running
  if (agentProcesses.has(id)) {
    const existing = agentProcesses.get(id)!;
    if (existing.running) {
      await audit('spawn_skipped', { reason: 'already_running', ...payload });
      return;
    }
  }

  // Check max agents
  const runningCount = Array.from(agentProcesses.values()).filter(a => a.running).length;
  if (runningCount >= config.max_agents) {
    await audit('spawn_rejected', { reason: 'max_agents_reached', count: runningCount, max: config.max_agents });
    throw new Error(`Max agents (${config.max_agents}) reached`);
  }

  // Get role permissions
  const perms = await getPermissionsForRole(payload.role);
  const model = payload.model || config.agent_defaults.model;
  const maxTurns = payload.max_turns || config.agent_defaults.max_turns;

  // Create worktree
  const worktreePath = await createWorktree(payload.session_id, payload.agent_key);

  // Bootstrap environment
  await bootstrapEnvironment(worktreePath);

  // Build spawn args
  const args = [
    '--print',
    '--output-format', 'json',
    '--model', model,
    '--max-turns', String(maxTurns),
    '--allowedTools', buildAllowedToolsArg(perms.toolAllowlist),
  ];

  if (payload.prompt) {
    args.push(payload.prompt);
  }

  // Spawn Claude Code
  const proc = execa('claude', args, {
    cwd: worktreePath,
    env: filterEnv(payload.env_vars),
    reject: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const agentProc: AgentProcess = {
    sessionId: payload.session_id,
    agentKey: payload.agent_key,
    role: payload.role,
    pid: proc.pid ?? 0,
    worktreePath,
    running: true,
    startedAt: new Date(),
    lastOutputAt: new Date(),
    restartCount: 0,
    process: proc,
  };

  agentProcesses.set(id, agentProc);

  // Capture output timestamps
  proc.stdout?.on('data', () => {
    agentProc.lastOutputAt = new Date();
  });
  proc.stderr?.on('data', () => {
    agentProc.lastOutputAt = new Date();
  });

  // Handle process exit
  proc.then((result) => {
    agentProc.running = false;
    agentProc.exitCode = result.exitCode;
    audit('agent_exited', {
      sessionId: payload.session_id,
      agentKey: payload.agent_key,
      exitCode: result.exitCode,
      pid: agentProc.pid,
    }).catch(err => {
      console.error(`[spawn] Failed to audit agent exit for ${payload.agent_key}:`, err);
    });
  }).catch(err => {
    agentProc.running = false;
    console.error(`[spawn] Process error for ${payload.agent_key}:`, err);
  });

  await audit('agent_spawned', {
    sessionId: payload.session_id,
    agentKey: payload.agent_key,
    role: payload.role,
    pid: proc.pid,
    worktreePath,
    model,
    maxTurns,
    tools: perms.toolAllowlist,
  });

  console.log(`[spawn] Agent ${payload.agent_key} (PID ${proc.pid}) started in ${worktreePath}`);
}
