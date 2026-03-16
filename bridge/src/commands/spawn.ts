import { execa } from 'execa';
import { loadConfig } from '../config.js';
import { getPermissionsForRole, buildAllowedToolsArg } from '../security/permissions.js';
import { createWorktree } from '../worktree/manager.js';
import { bootstrapEnvironment } from '../worktree/bootstrap.js';
import { audit } from '../audit/logger.js';
import { selectVps, updateVps } from '../vps/vpsRegistry.js';
import { registerOwnership, releaseOwnership } from '../ownership/registry.js';
import { checkOwnershipConflict, formatConflicts } from '../ownership/enforcer.js';
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
  /** Explicit VPS node ID. When absent, the load balancer selects the best node. */
  vps_id?: string;
  /** Load-balancing strategy when vps_id is not specified. Defaults to 'least-loaded'. */
  lb_strategy?: 'least-loaded' | 'round-robin';
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

  // VPS selection — if vps_id is not specified, use the load balancer to pick a healthy node.
  // If no VPS nodes are registered or reachable, the agent spawns locally (current machine).
  let selectedVpsId: string | undefined = payload.vps_id;
  if (!selectedVpsId) {
    const vps = await selectVps(payload.lb_strategy ?? 'least-loaded');
    if (vps) {
      selectedVpsId = vps.id;
      // Increment agentCount so subsequent selections see updated load
      await updateVps(vps.id, { agentCount: (vps.agentCount ?? 0) + 1 });
      await audit('vps_selected', { vpsId: vps.id, strategy: payload.lb_strategy ?? 'least-loaded', sessionId: payload.session_id });
      console.log(`[spawn] Load balancer selected VPS ${vps.label} (${vps.host}) for agent ${payload.agent_key}`);
    }
  }

  // Get role permissions
  const perms = await getPermissionsForRole(payload.role);
  const model = payload.model || config.agent_defaults.model;

  // Ownership conflict check — warn if another agent in the same session
  // already owns overlapping paths. The spawn proceeds but logs a warning
  // so operators can detect unintended concurrent writes.
  const conflicts = checkOwnershipConflict(payload.session_id, payload.agent_key, perms.directoryScope);
  if (conflicts.length > 0) {
    console.warn(
      `[spawn] Ownership conflict for ${payload.agent_key} in session ${payload.session_id}:\n` +
      formatConflicts(conflicts),
    );
    await audit('ownership_conflict', {
      agentKey: payload.agent_key,
      sessionId: payload.session_id,
      conflicts,
    });
  }
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

  // Register ownership for the agent's directory scope
  registerOwnership(payload.session_id, payload.agent_key, perms.directoryScope);

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
    releaseOwnership(payload.session_id, payload.agent_key);
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
    releaseOwnership(payload.session_id, payload.agent_key);
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
    vpsId: selectedVpsId,
  });

  console.log(`[spawn] Agent ${payload.agent_key} (PID ${proc.pid}) started in ${worktreePath}`);
}
