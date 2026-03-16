/**
 * In-memory SessionState manager.
 * Accumulates changes from individual tool calls and pushes the complete
 * state blob to the Supabase ingest-state edge function after each mutation.
 */

import type {
  SessionState,
  Stage,
  Agent,
  Task,
  AgentEvent,
  AgentMetrics,
  TaskStatus,
  TaskPriority,
  AgentStatus,
  AgentType,
} from "./types.js";

const SUPABASE_URL = process.env.AMC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.AMC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const INGEST_ENDPOINT = `${SUPABASE_URL}/functions/v1/ingest-state`;

/** Current session state held in memory */
let state: SessionState = {
  project: "",
  currentStageIdx: 0,
  totalTasks: 0,
  completedTasks: 0,
  stages: [],
  agents: [],
  tasks: [],
  events: [],
};

let sessionId: string | undefined = process.env.AMC_SESSION_ID;

// ── Helpers ──────────────────────────────────────────────────

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function deriveSessionId(project: string): string {
  return project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function recomputeTaskCounts(): void {
  state.totalTasks = state.tasks.length;
  state.completedTasks = state.tasks.filter((t) => t.status === "done").length;
}

// ── Push to Supabase ─────────────────────────────────────────

async function pushState(): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, error: "Missing AMC_SUPABASE_URL or AMC_SUPABASE_KEY environment variables" };
  }

  const payload = { ...state };
  if (sessionId) {
    payload.session_id = sessionId;
  }

  try {
    const res = await fetch(INGEST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body}` };
    }

    const data = (await res.json()) as { ok: boolean; session_id?: string };
    // Capture the session_id returned by the server on first push
    if (data.session_id && !sessionId) {
      sessionId = data.session_id;
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Public API ───────────────────────────────────────────────

export function getState(): SessionState {
  return state;
}

export function getSessionId(): string | undefined {
  return sessionId;
}

/**
 * Initialize or update session metadata.
 */
export async function reportSession(params: {
  project: string;
  session_id?: string;
  stages?: Array<{ name: string; desc?: string; status: string }>;
  agents?: Array<{
    id: string;
    name: string;
    role: string;
    type: string;
    status: string;
    icon: string;
    task?: string;
    taskId?: string | null;
  }>;
  currentStageIdx?: number;
}): Promise<{ ok: boolean; session_id?: string; error?: string }> {
  state.project = params.project;

  if (params.session_id) {
    sessionId = params.session_id;
  } else if (!sessionId) {
    sessionId = deriveSessionId(params.project);
  }

  if (params.currentStageIdx !== undefined) {
    state.currentStageIdx = params.currentStageIdx;
  }

  if (params.stages) {
    state.stages = params.stages.map((s) => ({
      name: s.name,
      desc: s.desc,
      status: s.status as Stage["status"],
    }));
  }

  if (params.agents) {
    state.agents = params.agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      type: a.type as AgentType,
      status: a.status as AgentStatus,
      icon: a.icon,
      task: a.task ?? "",
      taskId: a.taskId ?? null,
      metrics: { ctx: "0%", cost: "$0.00", msgs: 0 },
    }));
  }

  const result = await pushState();
  return { ...result, session_id: sessionId };
}

/**
 * Create one or more tasks in the backlog.
 */
export async function createTasks(
  tasks: Array<{
    id: string;
    title: string;
    status?: string;
    assignee?: string;
    priority?: string;
    deps?: string[];
    depOf?: string | null;
    rec?: boolean;
    recWhy?: string;
  }>
): Promise<{ ok: boolean; created: number; error?: string }> {
  const newTasks: Task[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: (t.status as TaskStatus) || "backlog",
    assignee: t.assignee || "",
    priority: (t.priority as TaskPriority) || "medium",
    deps: t.deps ?? [],
    depOf: t.depOf ?? null,
    rec: t.rec ?? false,
    recWhy: t.recWhy ?? "",
  }));

  // Merge: update existing, add new
  for (const task of newTasks) {
    const idx = state.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      state.tasks[idx] = task;
    } else {
      state.tasks.push(task);
    }
  }

  recomputeTaskCounts();
  const result = await pushState();
  return { ...result, created: newTasks.length };
}

/**
 * Update a single task's fields.
 */
export async function updateTask(params: {
  id: string;
  status?: string;
  priority?: string;
  title?: string;
  deps?: string[];
  depOf?: string | null;
  rec?: boolean;
  recWhy?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const task = state.tasks.find((t) => t.id === params.id);
  if (!task) {
    return { ok: false, error: `Task '${params.id}' not found. Available: ${state.tasks.map((t) => t.id).join(", ")}` };
  }

  if (params.status) {
    task._prevSt = task.status;
    task.status = params.status as TaskStatus;
  }
  if (params.priority) task.priority = params.priority as TaskPriority;
  if (params.title) task.title = params.title;
  if (params.deps) task.deps = params.deps;
  if (params.depOf !== undefined) task.depOf = params.depOf;
  if (params.rec !== undefined) task.rec = params.rec;
  if (params.recWhy !== undefined) task.recWhy = params.recWhy;

  recomputeTaskCounts();
  return pushState();
}

/**
 * Assign a task to an agent (bidirectional link).
 */
export async function assignTask(params: {
  task_id: string;
  agent_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const task = state.tasks.find((t) => t.id === params.task_id);
  if (!task) {
    return { ok: false, error: `Task '${params.task_id}' not found` };
  }
  const agent = state.agents.find((a) => a.id === params.agent_id);
  if (!agent) {
    return { ok: false, error: `Agent '${params.agent_id}' not found` };
  }

  task.assignee = agent.name;
  agent.taskId = task.id;
  agent.task = task.title;

  return pushState();
}

/**
 * Flag a task for approval (rec=true + reason).
 */
export async function requestApproval(params: {
  task_id: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const task = state.tasks.find((t) => t.id === params.task_id);
  if (!task) {
    return { ok: false, error: `Task '${params.task_id}' not found` };
  }

  task.rec = true;
  task.recWhy = params.reason;

  // Also push an event
  state.events.unshift({
    agent: task.assignee || "system",
    type: "task",
    text: `Approval requested for "${task.title}": ${params.reason}`,
    timestamp: now(),
  });

  return pushState();
}

/**
 * Update an agent's metrics.
 */
export async function reportMetrics(params: {
  agent_id: string;
  ctx?: string;
  cost?: string;
  msgs?: number;
  status?: string;
  task?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const agent = state.agents.find((a) => a.id === params.agent_id);
  if (!agent) {
    return { ok: false, error: `Agent '${params.agent_id}' not found` };
  }

  if (params.ctx) agent.metrics.ctx = params.ctx;
  if (params.cost) agent.metrics.cost = params.cost;
  if (params.msgs !== undefined) agent.metrics.msgs = params.msgs;
  if (params.status) agent.status = params.status as AgentStatus;
  if (params.task) agent.task = params.task;

  return pushState();
}

/**
 * Add one or more events to the activity feed.
 */
export async function pushEvent(
  events: Array<{
    agent: string;
    type: string;
    text: string;
    timestamp?: string;
  }>
): Promise<{ ok: boolean; pushed: number; error?: string }> {
  const newEvents: AgentEvent[] = events.map((e) => ({
    agent: e.agent,
    type: e.type as AgentEvent["type"],
    text: e.text,
    timestamp: e.timestamp || now(),
  }));

  // Prepend (newest first) and cap at 200
  state.events = [...newEvents, ...state.events].slice(0, 200);

  const result = await pushState();
  return { ...result, pushed: newEvents.length };
}
