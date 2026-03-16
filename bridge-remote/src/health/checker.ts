/**
 * Process health checker for agent-bridge-remote.
 * Monitors locally running Claude Code agent processes.
 */

export interface LocalAgentProcess {
  agentKey: string;
  pid: number;
  sessionId: string;
  startedAt: Date;
}

export function isPidAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function checkAgentHealth(agents: LocalAgentProcess[]): Array<{ agentKey: string; alive: boolean; uptimeMs: number }> {
  const now = Date.now();
  return agents.map((a) => ({
    agentKey: a.agentKey,
    alive: isPidAlive(a.pid),
    uptimeMs: now - a.startedAt.getTime(),
  }));
}
