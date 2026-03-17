import { audit } from '../audit/logger.js';
import { decompose } from './decompose.js';
import { assignTask } from '../assign/assigner.js';
import { agentProcesses } from '../commands/spawn.js';
import type { DecomposeRequest, DecomposeResult, Subtask } from './types.js';
import type { KanbanTask } from '../assign/assigner.js';

/**
 * Handle a decompose_objective command.
 *
 * Calls the Claude decompose function and dispatches subtasks in parallel
 * batches, respecting the dependency graph encoded in each subtask's
 * `dependsOn` field. Tasks with no unsatisfied dependencies are dispatched
 * concurrently via Promise.allSettled; dependent tasks wait until all of
 * their declared dependencies have been dispatched.
 *
 * DAG enforcement: a topological sort (Kahn's algorithm) partitions the
 * subtask list into ordered batches. Within each batch all items are
 * independent and assigned in parallel. Cycles are handled gracefully —
 * any subtask that cannot be sorted (cycle participant or unknown dep) is
 * appended to the final batch rather than dropped.
 */
export async function handleDecomposeObjective(payload: DecomposeRequest): Promise<DecomposeResult> {
  await audit('decompose_started', {
    sessionId: payload.sessionId,
    agentKey: payload.agentKey,
    objective: payload.objective.slice(0, 200),
  });

  const result = await decompose(payload);

  if (result.subtasks.length === 0) {
    return result;
  }

  // Build the initial kanban task list (no assignments yet).
  const kanbanTasks: KanbanTask[] = result.subtasks.map(s => ({
    id: s.id,
    title: s.title,
    tags: [],
    assignedAgentKey: undefined,
  }));

  const allAgents = Array.from(agentProcesses.values());
  const subtaskMap = new Map(result.subtasks.map(s => [s.id, s]));

  // ── Kahn's topological sort → ordered batches ────────────────────────────

  const inDegree = new Map<string, number>();
  for (const subtask of result.subtasks) {
    if (!inDegree.has(subtask.id)) inDegree.set(subtask.id, 0);
    for (const dep of subtask.dependsOn) {
      if (subtaskMap.has(dep)) {
        inDegree.set(subtask.id, (inDegree.get(subtask.id) ?? 0) + 1);
      }
      // Ignore dependencies that reference unknown subtask IDs.
    }
  }

  const batches: Subtask[][] = [];
  const processed = new Set<string>();

  while (processed.size < result.subtasks.length) {
    const batch = result.subtasks.filter(
      s => !processed.has(s.id) && (inDegree.get(s.id) ?? 0) === 0,
    );

    if (batch.length === 0) {
      // Cycle detected — append all remaining subtasks as a final fallback batch.
      const remaining = result.subtasks.filter(s => !processed.has(s.id));
      if (remaining.length > 0) batches.push(remaining);
      break;
    }

    batches.push(batch);

    // Mark batch as processed and reduce in-degrees for dependents.
    for (const subtask of batch) {
      processed.add(subtask.id);
      for (const other of result.subtasks) {
        if (other.dependsOn.includes(subtask.id)) {
          inDegree.set(other.id, (inDegree.get(other.id) ?? 1) - 1);
        }
      }
    }
  }

  // ── Parallel batch dispatch ───────────────────────────────────────────────

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async subtask => {
        const kanbanTask = kanbanTasks.find(k => k.id === subtask.id)!;

        const assigned = await assignTask(kanbanTask, allAgents, kanbanTasks);
        if (assigned) {
          kanbanTask.assignedAgentKey = assigned.agentKey;
        }

        await registerSubtask(payload.sessionId, payload.agentKey, subtask, assigned?.agentKey);
      }),
    );
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
