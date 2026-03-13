import { agentProcesses } from './spawn.js';
import { removeWorktree } from '../worktree/manager.js';
import { audit } from '../audit/logger.js';

export interface TerminatePayload {
  session_id: string;
  agent_key: string;
  cleanup_worktree?: boolean;
}

export async function terminateAgent(payload: TerminatePayload): Promise<void> {
  const id = `${payload.session_id}:${payload.agent_key}`;
  const agent = agentProcesses.get(id);

  if (!agent) {
    await audit('terminate_skipped', { reason: 'not_found', ...payload });
    return;
  }

  if (agent.running && agent.process) {
    // Graceful: SIGTERM first
    try {
      agent.process.kill('SIGTERM');
      console.log(`[terminate] Sent SIGTERM to ${payload.agent_key} (PID ${agent.pid})`);

      // Wait up to 5 seconds for graceful exit
      await Promise.race([
        agent.process,
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);
    } catch {
      // Ignore
    }

    // Force kill if still running
    if (agent.running) {
      try {
        agent.process.kill('SIGKILL');
        console.log(`[terminate] Sent SIGKILL to ${payload.agent_key} (PID ${agent.pid})`);
      } catch {
        // Process may have already exited
      }
    }
  }

  agent.running = false;

  // Optionally clean up worktree
  if (payload.cleanup_worktree !== false) {
    await removeWorktree(payload.session_id, payload.agent_key);
  }

  agentProcesses.delete(id);

  await audit('agent_terminated', {
    sessionId: payload.session_id,
    agentKey: payload.agent_key,
    pid: agent.pid,
  });

  console.log(`[terminate] Agent ${payload.agent_key} terminated`);
}

export async function terminateAll(): Promise<void> {
  const entries = Array.from(agentProcesses.entries());
  for (const [, agent] of entries) {
    await terminateAgent({
      session_id: agent.sessionId,
      agent_key: agent.agentKey,
      cleanup_worktree: false,
    });
  }
  await audit('all_agents_terminated', { count: entries.length });
}
