/**
 * Ownership Registry — tracks which agent owns which directory paths.
 *
 * Prevents two concurrent agents from writing to the same paths, avoiding
 * merge conflicts and race conditions in the worktree.
 *
 * Ownership is per-session — the same path can be owned by different agents
 * in different sessions (each session uses isolated worktrees).
 *
 * In-memory only. Ownership is re-registered from agentProcesses on bridge restart.
 */

export interface OwnershipEntry {
  agentKey: string;
  sessionId: string;
  ownedPaths: string[];
  registeredAt: string;
}

// Map key: `${sessionId}:${agentKey}`
const ownershipMap = new Map<string, OwnershipEntry>();

/**
 * Register ownership of directory paths for an agent.
 * Paths are stored as-is (relative or absolute, matching directoryScope config).
 */
export function registerOwnership(
  sessionId: string,
  agentKey: string,
  ownedPaths: string[],
): void {
  ownershipMap.set(`${sessionId}:${agentKey}`, {
    agentKey,
    sessionId,
    ownedPaths,
    registeredAt: new Date().toISOString(),
  });
}

/**
 * Release all ownership entries for an agent (called on exit or termination).
 */
export function releaseOwnership(sessionId: string, agentKey: string): void {
  ownershipMap.delete(`${sessionId}:${agentKey}`);
}

/**
 * Return all active ownership entries for a session.
 */
export function getSessionOwnership(sessionId: string): OwnershipEntry[] {
  return Array.from(ownershipMap.values()).filter((e) => e.sessionId === sessionId);
}

/**
 * Return the full ownership map (all sessions).
 */
export function getAllOwnership(): OwnershipEntry[] {
  return Array.from(ownershipMap.values());
}
