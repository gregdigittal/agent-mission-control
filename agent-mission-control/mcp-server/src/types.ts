/**
 * Types matching the Agent Mission Control dashboard's SessionState schema.
 * These mirror src/lib/types.ts in the Next.js app.
 */

export type StageStatus = "completed" | "active" | "pending";
export type AgentType = "leader" | "backend" | "frontend" | "tester" | "reviewer";
export type AgentStatus = "working" | "thinking" | "idle" | "error" | "leader";
export type TaskStatus = "backlog" | "in-progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type EventType = "tool" | "file" | "task" | "message" | "thinking" | "error";

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

export interface SessionState {
  project: string;
  session_id?: string;
  currentStageIdx: number;
  totalTasks: number;
  completedTasks: number;
  stages: Stage[];
  agents: Agent[];
  tasks: Task[];
  events: AgentEvent[];
}
