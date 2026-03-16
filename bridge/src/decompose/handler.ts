import { audit } from '../audit/logger.js';
import { decompose } from './decompose.js';
import { assignTask } from '../assign/assigner.js';
import { agentProcesses } from '../commands/spawn.js';
import type { DecomposeRequest, DecomposeResult, Subtask } from './types.js';
import type { KanbanTask } from '../assign/assigner.js';

/**
 * Handle a decompose_objective command.
 *
 * Calls the Claude decompose function and registers each resulting subtask
 * via the audit log (the bridge's task registration mechanism). Returns the
 * full DecomposeResult so callers can inspect the subtask list.
 *
 * Note: The bridge does not maintain an in-process kanban store — task state
 * is persisted in Supabase (when enabled) or read from dashboard_state.json.
 * For now, subtasks are registered via audit events that downstream consumers
 * (dashboard, Supabase sync) can act on.
 */
export async function handleDecomposeObjective(payload: DecomposeRequest): Promise<DecomposeResult> {
  await audit('decompose_started', {
    sessionId: payload.sessionId,
    agentKey: payload.agentKey,
    objective: payload.objective.slice(0, 200),
  });

  const result = await decompose(payload);

  // Build a KanbanTask list from the decomposed subtasks so the assigner can
  // calculate relative load. None of these have an assigned agent yet.
  const kanbanTasks: KanbanTask[] = result.subtasks.map(s => ({
    id: s.id,
    title: s.title,
    tags: [],           // decomposed subtasks carry no tags yet — the UI may enrich later
    assignedAgentKey: undefined,
  }));

  // Auto-assign each subtask to the best available agent (if one is running).
  const allAgents = Array.from(agentProcesses.values());

  for (let i = 0; i < result.subtasks.length; i++) {
    const subtask = result.subtasks[i];
    const kanbanTask = kanbanTasks[i];

    // Attempt assignment
    const assigned = await assignTask(kanbanTask, allAgents, kanbanTasks);
    if (assigned) {
      // Update the kanban task list so subsequent iterations see updated load
      kanbanTask.assignedAgentKey = assigned.agentKey;
    }

    await registerSubtask(payload.sessionId, payload.agentKey, subtask, assigned?.agentKey);
  }

  console.log(
    `[decompose] Registered ${result.subtasks.length} subtask(s) for session ${payload.sessionId}`,
  );

  return result;
}

async function registerSubtask(
  sessionId: string,
  agentKey: string,
  subtask: Subtask,
  assignedAgentKey?: string,
): Promise<void> {
  await audit('subtask_registered', {
    sessionId,
    agentKey,
    subtaskId: subtask.id,
    title: subtask.title,
    description: subtask.description,
    estimatedTurns: subtask.estimatedTurns,
    dependsOn: subtask.dependsOn,
    status: 'backlog',
    assignedAgentKey: assignedAgentKey ?? null,
  });
}
