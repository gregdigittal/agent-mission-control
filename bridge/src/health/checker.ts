import { agentProcesses } from '../commands/spawn.js';
import { audit } from '../audit/logger.js';

export interface AgentProcess {
  sessionId: string;
  agentKey: string;
  role: string;
  pid: number;
  worktreePath: string;
  running: boolean;
  startedAt: Date;
  lastOutputAt: Date;
  restartCount: number;
  exitCode?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process?: any;
}

// If no output for this long, consider the agent stale
const STALE_THRESHOLD_MS = 300_000; // 5 minutes

export interface HealthResult {
  agent: string;
  status: 'healthy' | 'stale' | 'crashed' | 'exited';
  pid: number;
  uptimeMs: number;
  lastOutputMs: number;
}

export async function checkHealth(): Promise<HealthResult[]> {
  const results: HealthResult[] = [];
  const now = Date.now();

  for (const [id, agent] of agentProcesses) {
    const uptimeMs = now - agent.startedAt.getTime();
    const lastOutputMs = now - agent.lastOutputAt.getTime();

    if (!agent.running) {
      results.push({
        agent: agent.agentKey,
        status: agent.exitCode !== undefined ? 'exited' : 'crashed',
        pid: agent.pid,
        uptimeMs,
        lastOutputMs,
      });

      await audit('health_check', {
        agentKey: agent.agentKey,
        status: 'crashed',
        pid: agent.pid,
        exitCode: agent.exitCode,
      });
      continue;
    }

    // Check if PID is still alive
    const alive = isPidAlive(agent.pid);
    if (!alive) {
      agent.running = false;
      results.push({
        agent: agent.agentKey,
        status: 'crashed',
        pid: agent.pid,
        uptimeMs,
        lastOutputMs,
      });

      await audit('health_check', {
        agentKey: agent.agentKey,
        status: 'pid_dead',
        pid: agent.pid,
      });
      continue;
    }

    // Check for staleness
    if (lastOutputMs > STALE_THRESHOLD_MS) {
      results.push({
        agent: agent.agentKey,
        status: 'stale',
        pid: agent.pid,
        uptimeMs,
        lastOutputMs,
      });
      continue;
    }

    results.push({
      agent: agent.agentKey,
      status: 'healthy',
      pid: agent.pid,
      uptimeMs,
      lastOutputMs,
    });
  }

  return results;
}

function isPidAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0); // Signal 0 = check existence
    return true;
  } catch {
    return false;
  }
}
