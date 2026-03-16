/**
 * Context Handoff Manager — auto-spawns a continuation agent when context nears full.
 *
 * When an agent's context usage reaches HANDOFF_THRESHOLD (80%), the bridge
 * spawns a new agent in a fresh worktree with a handoff prompt that summarises
 * the current task. Each agent is only handed off once per bridge session.
 *
 * Architectural notes:
 * - No network listeners — uses spawnAgent() directly.
 * - Audit log entry written on each handoff.
 * - Handed-off agents are tracked in memory; the original agent continues
 *   running until it exits naturally (or is terminated via normal command flow).
 */

import { spawnAgent, agentProcesses } from '../commands/spawn.js';
import { audit } from '../audit/logger.js';
import type { DashboardState } from '../state/aggregator.js';

const HANDOFF_THRESHOLD = 80; // percent

// Agents that have already had a handoff spawned this session.
// Key: `${sessionId}:${agentKey}`
const handedOffAgents = new Set<string>();

function buildHandoffPrompt(agentKey: string, task: string, contextPct: number): string {
  return (
    `[CONTEXT HANDOFF] You are continuing the work of agent "${agentKey}", ` +
    `whose context window is ${contextPct}% full and can no longer proceed.\n\n` +
    `Their last recorded task:\n${task || '(no task description recorded)'}\n\n` +
    `Pick up from where they left off. Review the worktree files to understand ` +
    `current state, then continue the work without repeating completed steps.`
  );
}

/**
 * Check all running agents and spawn a handoff agent for any that are at or
 * above HANDOFF_THRESHOLD. Safe to call on every bridge loop cycle.
 */
export async function checkAndHandoff(state: DashboardState): Promise<void> {
  for (const session of state.sessions) {
    for (const agent of session.agents) {
      if (agent.ctx < HANDOFF_THRESHOLD) continue;
      if (!agent.pid) continue; // skip aggregated-but-not-running agents

      const handoffKey = `${session.id}:${agent.key}`;
      if (handedOffAgents.has(handoffKey)) continue;

      // Look up the original process to confirm it is still running
      const proc = agentProcesses.get(handoffKey);
      if (!proc?.running) continue;

      // Mark as handed off before spawning to prevent duplicate spawns
      // even if spawn throws (idempotency guard)
      handedOffAgents.add(handoffKey);

      const continuationKey = `${agent.key}-handoff`;
      const prompt = buildHandoffPrompt(agent.key, agent.task, agent.ctx);

      await audit('context_handoff_initiated', {
        originalAgent: agent.key,
        continuationAgent: continuationKey,
        sessionId: session.id,
        contextPct: agent.ctx,
      });

      console.warn(
        `[handoff] Agent ${agent.key} context at ${agent.ctx}% — ` +
        `spawning continuation agent ${continuationKey}`,
      );

      try {
        await spawnAgent({
          session_id: session.id,
          agent_key: continuationKey,
          role: agent.role,
          prompt,
        });

        await audit('context_handoff_complete', {
          originalAgent: agent.key,
          continuationAgent: continuationKey,
          sessionId: session.id,
        });
      } catch (err) {
        // Log but do not crash the bridge — handoff failure is non-critical
        const message = err instanceof Error ? err.message : String(err);
        await audit('context_handoff_error', {
          originalAgent: agent.key,
          continuationAgent: continuationKey,
          sessionId: session.id,
          error: message,
        });
        console.error(`[handoff] Failed to spawn continuation for ${agent.key}:`, message);
      }
    }
  }
}
