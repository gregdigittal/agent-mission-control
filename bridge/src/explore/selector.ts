/**
 * Exploration winner selector.
 *
 * Determines the winning approach from a competition session.
 * Returns null if no winner can be selected yet (still running,
 * timed out, cancelled, or already merged).
 *
 * Selection policy: first completed approach in array order wins ties.
 */

import type { ExploreSession, CompetitionResult } from './types.js';

/**
 * Select the winner from a pending_approval competition session.
 *
 * @returns CompetitionResult when a winner can be identified, null otherwise.
 */
export function selectWinner(session: ExploreSession): CompetitionResult | null {
  if (session.status !== 'pending_approval') return null;

  // Resolve winner: prefer explicitly set winnerId, fall back to first completed approach.
  const winnerId = session.winnerId ?? session.approaches.find(a => a.status === 'completed')?.id;
  if (!winnerId) return null;

  const winnerApproach = session.approaches.find(a => a.id === winnerId);
  if (!winnerApproach) return null;

  const loserIds = session.approaches
    .filter(a => a.id !== winnerId)
    .map(a => a.id);

  return {
    winnerId,
    winnerApproach,
    loserIds,
    completedAt: new Date(),
  };
}
