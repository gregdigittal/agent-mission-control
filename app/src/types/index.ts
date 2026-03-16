// ============================================================
// Core domain types — Agent Mission Control
// ============================================================

export type ScreenProfile = 'mobile' | 'laptop' | 'desktop' | 'ultrawide';
export type PaneCount = 1 | 2 | 3 | 4;

// === Auth ===================================================

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

// === Sessions & Panes =======================================

export interface Session {
  id: string;
  name: string;
  color: SessionColor;
  projectId: string;
  vpsNodeId?: string;
  createdAt: string;
}

export type SessionColor = 'cyan' | 'green' | 'violet' | 'amber' | 'rose' | 'blue';

export interface Pane {
  id: string;
  sessionId: string;
  activeTab: PaneTab;
}

export type PaneTab = 'agents' | 'kanban' | 'costs' | 'approvals' | 'dag';

// === Agents =================================================

export type AgentStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'paused'
  | 'error'
  | 'complete';

export type BuildStage =
  | 'plan'
  | 'scaffold'
  | 'build'
  | 'test'
  | 'review'
  | 'fix'
  | 'deploy'
  | 'done';

export interface Agent {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  status: AgentStatus;
  model: string;
  provider: ModelProvider;
  currentTask?: string;
  buildStage?: BuildStage;
  buildProgress: number; // 0-100
  contextUsed: number;   // tokens
  contextLimit: number;
  contextUsagePct?: number; // 0-100; populated by bridge sync when token counts unavailable
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  pid?: number;
  worktree?: string;
  lastSeen: string;
  startedAt: string;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  sessionId: string;
  type: EventType;
  message: string;
  detail?: string;
  costUsd?: number;
  ts: string;
}

export type EventType =
  | 'tool_call'
  | 'tool_result'
  | 'message'
  | 'error'
  | 'approval_request'
  | 'approval_granted'
  | 'approval_rejected'
  | 'cost_alert'
  | 'stage_change'
  | 'agent_start'
  | 'agent_stop';

// === Kanban =================================================

export type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

export interface KanbanTask {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  assignedAgentId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedByAgent?: string;
  approvalRequired: boolean;
  approvedAt?: string;
  dependsOn?: string[];  // task ids this task depends on (for DAG visualisation)
  createdAt: string;
  updatedAt: string;
}

// === Cost ===================================================

export interface CostRecord {
  agentId: string;
  sessionId: string;
  model: string;
  provider: ModelProvider;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  ts: string;
}

export interface SessionBudget {
  sessionId: string;
  limitUsd: number;
  spentUsd: number;
  burnRatePerHour: number; // extrapolated from last 5 min
}

// === Models =================================================

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom';

export interface ModelConfig {
  id: string;
  userId: string;
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  inputCostPer1k: number;   // USD per 1k input tokens
  outputCostPer1k: number;  // USD per 1k output tokens
  apiEndpoint?: string;     // for ollama / custom
  isDefault: boolean;
}

// === Approvals ==============================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
  id: string;
  agentId: string;
  sessionId: string;
  action: string;
  description: string;
  files?: string[];
  riskLevel: RiskLevel;
  status: ApprovalStatus;
  rejectionReason?: string;
  createdAt: string;
  expiresAt?: string;
  resolvedAt?: string;
}

// === VPS ====================================================

export type VpsHealth = 'healthy' | 'degraded' | 'offline';

export interface VpsNode {
  id: string;
  name: string;
  host: string;
  region: string;
  health: VpsHealth;
  agentCount: number;
  agentCapacity: number;
  cpuPercent?: number;
  memPercent?: number;
  diskPercent?: number;
  lastHeartbeat: string;
}

// === Dashboard State (local JSON fallback) ==================

export interface DashboardState {
  ts: string;
  sessions: Session[];
  agents: Agent[];
  events: AgentEvent[];
  tasks: KanbanTask[];
  approvals: ApprovalRequest[];
  budgets: SessionBudget[];
  vpsNodes: VpsNode[];
}
