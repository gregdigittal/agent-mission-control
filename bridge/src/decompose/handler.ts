import { audit } from '../audit/logger.js';
import { decompose } from './decompose.js';
import type { DecomposeRequest, DecomposeResult, Subtask } from './types.js';

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

  // Register each subtask via audit — provides a durable record that the
  // dashboard and Supabase sync can consume.
  for (const subtask of result.subtasks) {
    await registerSubtask(payload.sessionId, payload.agentKey, subtask);
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
  });
}
