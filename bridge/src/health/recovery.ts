import { loadConfig } from '../config.js';
import { agentProcesses, spawnAgent } from '../commands/spawn.js';
import { audit } from '../audit/logger.js';
import type { HealthResult } from './checker.js';

const MAX_RESTARTS = 3;

export async function handleCrashedAgents(healthResults: HealthResult[]): Promise<void> {
  // Clean up agents that exited cleanly — they remain in the map forever otherwise
  const exited = healthResults.filter(r => r.status === 'exited');
  for (const result of exited) {
    for (const [id, agent] of agentProcesses.entries()) {
      if (agent.agentKey === result.agent && !agent.running) {
        agentProcesses.delete(id);
        await audit('agent_cleaned_up', { agentKey: agent.agentKey, exitCode: agent.exitCode });
        break;
      }
    }
  }

  const config = await loadConfig();
  if (!config.auto_restart_on_crash) return;

  const crashed = healthResults.filter(r => r.status === 'crashed');

  for (const result of crashed) {
    // Find the agent process entry
    let agentEntry: [string, typeof agentProcesses extends Map<string, infer V> ? V : never] | undefined;
    for (const entry of agentProcesses.entries()) {
      if (entry[1].agentKey === result.agent) {
        agentEntry = entry;
        break;
      }
    }

    if (!agentEntry) continue;
    const [id, agent] = agentEntry;

    if (agent.restartCount >= MAX_RESTARTS) {
      await audit('auto_restart_exhausted', {
        agentKey: agent.agentKey,
        restarts: agent.restartCount,
        max: MAX_RESTARTS,
      });
      console.warn(`[recovery] Agent ${agent.agentKey} exhausted ${MAX_RESTARTS} restart attempts`);
      agentProcesses.delete(id);
      continue;
    }

    console.log(`[recovery] Restarting crashed agent ${agent.agentKey} (attempt ${agent.restartCount + 1}/${MAX_RESTARTS})`);

    // Remove old entry
    agentProcesses.delete(id);

    try {
      await spawnAgent({
        session_id: agent.sessionId,
        agent_key: agent.agentKey,
        role: agent.role,
      });

      // Update restart count on the new entry
      const newId = `${agent.sessionId}:${agent.agentKey}`;
      const newAgent = agentProcesses.get(newId);
      if (newAgent) {
        newAgent.restartCount = agent.restartCount + 1;
      }

      await audit('auto_restart', {
        agentKey: agent.agentKey,
        attempt: agent.restartCount + 1,
      });
    } catch (err) {
      await audit('auto_restart_failed', {
        agentKey: agent.agentKey,
        error: String(err),
      });
      console.error(`[recovery] Failed to restart ${agent.agentKey}:`, err);
    }
  }
}
