import { agentProcesses } from '../commands/spawn.js';
import { readClaudeState } from './claude-reader.js';

export interface AgentState {
  key: string;
  name: string;
  role: string;
  icon: string;
  status: string;
  task: string;
  ctx: number;
  cost: number;
  msgs: number;
  files: string[];
  pid: number;
  worktreePath: string;
  budgetLimit: number | null;
  uptime: number;
}

export interface SessionState {
  id: string;
  name: string;
  status: string;
  agents: AgentState[];
  totalCost: number;
  currentStage: number;
}

export interface DashboardState {
  sessions: SessionState[];
  timestamp: string;
  bridgeUptime: number;
}

const bridgeStartTime = Date.now();

const AGENT_ICONS: Record<string, string> = {
  lead: '🤖',
  backend: '⚡',
  frontend: '📡',
  testing: '🧠',
  devops: '🔄',
  reviewer: '👀',
};

export async function aggregateState(): Promise<DashboardState> {
  // Group agents by session
  const sessionMap = new Map<string, AgentState[]>();

  for (const [, agent] of agentProcesses) {
    if (!sessionMap.has(agent.sessionId)) {
      sessionMap.set(agent.sessionId, []);
    }

    // Try to read Claude Code state for richer data
    const claudeState = await readClaudeState(agent.worktreePath);

    const agentState: AgentState = {
      key: agent.agentKey,
      name: agent.agentKey.charAt(0).toUpperCase() + agent.agentKey.slice(1),
      role: agent.role,
      icon: AGENT_ICONS[agent.role] || '🤖',
      status: agent.running
        ? (claudeState?.status || 'working')
        : 'error',
      task: claudeState?.currentTask || '',
      ctx: claudeState?.contextUsagePct || 0,
      cost: claudeState?.costCents || 0,
      msgs: claudeState?.messageCount || 0,
      files: claudeState?.activeFiles || [],
      pid: agent.pid,
      worktreePath: agent.worktreePath,
      budgetLimit: null,
      uptime: Date.now() - agent.startedAt.getTime(),
    };

    sessionMap.get(agent.sessionId)!.push(agentState);
  }

  const sessions: SessionState[] = [];
  for (const [sessionId, agents] of sessionMap) {
    sessions.push({
      id: sessionId,
      name: sessionId,
      status: agents.some(a => a.status === 'error') ? 'degraded' : 'active',
      agents,
      totalCost: agents.reduce((sum, a) => sum + a.cost, 0),
      currentStage: 0,
    });
  }

  return {
    sessions,
    timestamp: new Date().toISOString(),
    bridgeUptime: Date.now() - bridgeStartTime,
  };
}
