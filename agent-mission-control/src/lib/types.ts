// src/lib/types.ts
// Mirror of agent_state.json schema + UI state

export type StageStatus = "completed" | "active" | "pending";
export type AgentType = "leader" | "backend" | "frontend" | "tester" | "reviewer";
export type AgentStatus = "working" | "thinking" | "idle" | "error" | "leader";
export type TaskStatus = "backlog" | "in-progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type EventType = "tool" | "file" | "task" | "message" | "thinking" | "error";
export type ScreenProfile = "laptop" | "desktop" | "ultrawide";
export type PaneView = "agents" | "kanban";

export interface Stage {
  name: string;
  desc?: string;
  status: StageStatus;
}

export interface AgentMetrics {
  ctx: string;
  cost: string;
  msgs: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  type: AgentType;
  status: AgentStatus;
  icon: string;
  task: string;
  taskId: string | null;
  metrics: AgentMetrics;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: string;
  priority: TaskPriority;
  deps?: string[];
  depOf?: string | null;
  rec: boolean;
  recWhy: string;
  _auto?: boolean;
  _prevSt?: TaskStatus | null;
}

export interface AgentEvent {
  agent: string;
  type: EventType;
  text: string;
  timestamp: string;
}

/** The full state blob pushed from Claude Code */
export interface SessionState {
  project: string;
  currentStageIdx: number;
  totalTasks: number;
  completedTasks: number;
  stages: Stage[];
  agents: Agent[];
  tasks: Task[];
  events: AgentEvent[];
}

/** A session row from the database */
export interface Session {
  id: string;
  project: string;
  state: SessionState;
  updated_at: string;
  created_at: string;
}

/** A single pane in the tiling manager */
export interface Pane {
  sid: string;
  view: PaneView;
}
