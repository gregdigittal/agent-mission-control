/**
 * Parallel exploration competition lifecycle.
 *
 * Manages the creation, monitoring, and cleanup of competing agent sessions
 * each attempting a different approach to the same objective.
 *
 * Architecture invariants enforced:
 *   - Bridge is the ONLY spawner of agents — uses spawnAgent() exclusively
 *   - Approval gate lives at bridge — winner surfaced via audit event
 *   - Each approach gets an isolated worktree — no shared filesystem state
 *   - No HTTP listeners introduced
 */

import { spawnAgent, agentProcesses } from '../commands/spawn.js';
import { createWorktree, removeWorktree } from '../worktree/manager.js';
import { audit } from '../audit/logger.js';
import type { ExploreSession, Approach, ExploreParallelPayload } from './types.js';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Start a parallel exploration competition.
 *
 * Creates an isolated worktree and spawns one agent per approach.
 * Returns an ExploreSession that can be polled via pollCompetition().
 */
export async function startCompetition(payload: ExploreParallelPayload): Promise<ExploreSession> {
  const exploreSessionId = `explore-${Date.now()}`;
  const timeoutMs = payload.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  await audit('explore_started', {
    exploreSessionId,
    parentSessionId: payload.sessionId,
    objective: payload.objective.slice(0, 200),
    approachCount: payload.approaches.length,
  });

  const approaches: Approach[] = [];

  for (let i = 0; i < payload.approaches.length; i++) {
    const agentKey = `approach-${i}`;
    const description = payload.approaches[i] ?? `Approach ${i}`;

    const worktreePath = await createWorktree(exploreSessionId, agentKey);

    await spawnAgent({
      session_id: exploreSessionId,
      agent_key: agentKey,
      role: 'explorer',
      prompt: buildApproachPrompt(payload.objective, description),
    });

    approaches.push({
      id: agentKey,
      description,
      sessionId: exploreSessionId,
      agentKey,
      worktreePath,
      status: 'running',
      startedAt: new Date(),
    });
  }

  return {
    id: exploreSessionId,
    objective: payload.objective,
    approaches,
    status: 'running',
    startedAt: new Date(),
    timeoutMs,
  };
}

/**
 * Poll an active competition session.
 *
 * Updates approach statuses from the agentProcesses registry.
 * Sets session.status to 'pending_approval' when the first approach completes,
 * or 'timeout' when the elapsed time exceeds session.timeoutMs.
 *
 * Callers (the bridge main loop) should call this every tick while
 * session.status === 'running'.
 */
export async function pollCompetition(session: ExploreSession): Promise<void> {
  if (session.status !== 'running') return;

  const elapsed = Date.now() - session.startedAt.getTime();
  if (elapsed > session.timeoutMs) {
    session.status = 'timeout';
    session.completedAt = new Date();
    await audit('explore_timeout', { exploreSessionId: session.id, elapsed });
    return;
  }

  for (const approach of session.approaches) {
    if (approach.status !== 'running') continue;

    const agentEntry = agentProcesses.get(`${approach.sessionId}:${approach.agentKey}`);
    if (!agentEntry) continue;

    if (!agentEntry.running) {
      approach.status = agentEntry.exitCode === 0 ? 'completed' : 'failed';
      approach.completedAt = new Date();

      if (approach.status === 'completed' && !session.winnerId) {
        // First clean completion wins the competition.
        session.winnerId = approach.id;
        session.status = 'pending_approval';
        session.completedAt = new Date();

        await audit('explore_winner_ready', {
          exploreSessionId: session.id,
          winnerId: approach.id,
          description: approach.description,
          worktreePath: approach.worktreePath,
        });
      }
    }
  }
}

/**
 * Cancel a competition session — terminates all approaches and removes
 * their worktrees. Sets session.status to 'cancelled'.
 */
export async function cancelCompetition(session: ExploreSession): Promise<void> {
  await Promise.allSettled(
    session.approaches.map(a => removeWorktree(a.sessionId, a.agentKey)),
  );

  session.status = 'cancelled';
  session.completedAt = new Date();

  await audit('explore_cancelled', { exploreSessionId: session.id });
}

// ── Internal helpers ────────────────────────────────────────────────────────

function buildApproachPrompt(objective: string, approach: string): string {
  return `You are competing against other agents to implement the following objective.
Your specific approach is: ${approach}

Objective: ${objective}

Implement your approach completely. When done, commit your changes and exit.`;
}
