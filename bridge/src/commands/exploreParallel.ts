/**
 * Command handler — explore_parallel
 *
 * Starts a parallel exploration competition: each approach gets an isolated
 * worktree and a competing agent. The session is registered in the active
 * explore sessions registry for the main loop to poll.
 */

import { startCompetition } from '../explore/competition.js';
import { audit } from '../audit/logger.js';
import type { ExploreParallelPayload, ExploreSession } from '../explore/types.js';

/** In-process registry of active explore sessions, keyed by explore session ID. */
export const exploreSessions = new Map<string, ExploreSession>();

/**
 * Handle an explore_parallel command.
 *
 * Starts the competition and registers the resulting session so the main
 * bridge loop can call pollCompetition() on each tick.
 */
export async function handleExploreParallel(payload: ExploreParallelPayload): Promise<void> {
  if (!payload.approaches || payload.approaches.length === 0) {
    await audit('explore_parallel_rejected', {
      parentSessionId: payload.sessionId,
      reason: 'No approaches provided',
    });
    console.warn('[explore] explore_parallel rejected: no approaches');
    return;
  }

  const session = await startCompetition(payload);
  exploreSessions.set(session.id, session);

  console.log(
    `[explore] Competition started: ${session.id} — ${session.approaches.length} approaches`,
  );
}
