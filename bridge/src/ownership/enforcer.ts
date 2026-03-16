/**
 * Ownership Enforcer — validates that a new agent's directory scope
 * does not conflict with paths already owned by another running agent
 * in the same session.
 *
 * A conflict occurs when two agents in the same session have overlapping
 * directory scopes (one path is a prefix of the other, or they are equal).
 * Overlapping scopes indicate the agents could write to the same files.
 *
 * Usage: call checkOwnershipConflict() before spawning a new agent.
 * If it returns a conflict, reject the spawn or require explicit override.
 */

import { getSessionOwnership } from './registry.js';

export interface OwnershipConflict {
  claimingAgent: string;
  existingAgent: string;
  conflictingPath: string;
}

/**
 * Check if `candidatePaths` for a new agent overlap with any paths
 * already owned by another running agent in the same session.
 *
 * Returns an array of conflicts (empty = no conflicts, spawn is safe).
 */
export function checkOwnershipConflict(
  sessionId: string,
  newAgentKey: string,
  candidatePaths: string[],
): OwnershipConflict[] {
  const conflicts: OwnershipConflict[] = [];
  const existing = getSessionOwnership(sessionId).filter((e) => e.agentKey !== newAgentKey);

  for (const existingEntry of existing) {
    for (const candidatePath of candidatePaths) {
      for (const ownedPath of existingEntry.ownedPaths) {
        // Paths conflict if one is a prefix of the other (or they are equal).
        // Normalise by ensuring prefix comparison works on path segments.
        const norm = (p: string) => p.replace(/\/$/, '');
        const a = norm(candidatePath);
        const b = norm(ownedPath);

        if (a === b || a.startsWith(b + '/') || b.startsWith(a + '/')) {
          conflicts.push({
            claimingAgent: newAgentKey,
            existingAgent: existingEntry.agentKey,
            conflictingPath: a,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Format ownership conflicts as a human-readable error message for logs and audit.
 */
export function formatConflicts(conflicts: OwnershipConflict[]): string {
  return conflicts
    .map(
      (c) =>
        `  ${c.claimingAgent} wants "${c.conflictingPath}" but ${c.existingAgent} already owns it`,
    )
    .join('\n');
}
