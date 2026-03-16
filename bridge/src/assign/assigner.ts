/**
 * Auto task assignment — selects the best available agent for a new task.
 *
 * Selection criteria (in order of priority):
 *  1. Role match   — task tags must intersect the agent role's directory_scope
 *                    (or the agent role must be 'lead', which covers everything)
 *  2. Availability — agent.running must be true
 *  3. Load         — prefer the agent with the fewest active tasks
 *
 * Returns null when no agent is eligible.
 */

import { loadConfig } from '../config.js';
import type { AgentProcess } from '../health/checker.js';

/** Minimal kanban task shape required for assignment decisions. */
export type KanbanTask = {
  id: string;
  title: string;
  /** Freeform tags used to match against role directory scopes (e.g. 'backend', '/app', 'frontend'). */
  tags: string[];
  /** Number of active tasks already assigned to the agent that owns this task (used for load tracking). */
  assignedAgentKey?: string;
};

/**
 * Count how many tasks in the store are already assigned to a given agent key.
 * Accepts the full task list so the function remains pure and testable without
 * filesystem I/O.
 */
function countActiveTasks(agentKey: string, allTasks: KanbanTask[]): number {
  return allTasks.filter(t => t.assignedAgentKey === agentKey).length;
}

/**
 * Return true if the agent's role is compatible with the task's tags.
 *
 * Matching rules:
 * - The 'lead' role can be assigned any task (it has directory_scope ['/'])
 * - For other roles, at least one task tag must be a case-insensitive prefix
 *   or exact match of one of the role's directory_scope entries
 */
function roleMatchesTask(
  roleName: string,
  directoryScope: string[],
  taskTags: string[],
): boolean {
  // Lead agent handles everything
  if (roleName === 'lead') return true;

  // Check for any overlap between task tags and the role's directory scopes
  for (const tag of taskTags) {
    const tagLower = tag.toLowerCase();
    for (const scope of directoryScope) {
      const scopeLower = scope.toLowerCase().replace(/^\//, ''); // strip leading slash
      const tagNorm = tagLower.replace(/^\//, '');
      if (scopeLower === tagNorm || scopeLower.startsWith(tagNorm) || tagNorm.startsWith(scopeLower)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Select the best available agent for the given task.
 *
 * @param task      The task to be assigned.
 * @param agents    Snapshot of currently registered agent processes.
 * @param allTasks  Full list of tasks in the kanban store (used for load calculation).
 * @returns The best matching AgentProcess, or null if none is eligible.
 */
export async function assignTask(
  task: KanbanTask,
  agents: AgentProcess[],
  allTasks: KanbanTask[] = [],
): Promise<AgentProcess | null> {
  const config = await loadConfig();

  // Filter to running agents only
  const runningAgents = agents.filter(a => a.running);
  if (runningAgents.length === 0) return null;

  // Score each running agent
  const candidates: Array<{ agent: AgentProcess; load: number }> = [];

  for (const agent of runningAgents) {
    const roleConfig = config.agent_roles[agent.role];
    if (!roleConfig) {
      // Unknown role — skip
      continue;
    }

    const matches = roleMatchesTask(agent.role, roleConfig.directory_scope, task.tags);
    if (!matches) continue;

    const load = countActiveTasks(agent.agentKey, allTasks);
    candidates.push({ agent, load });
  }

  if (candidates.length === 0) return null;

  // Sort ascending by load; stable sort preserves insertion order for ties
  candidates.sort((a, b) => a.load - b.load);

  return candidates[0].agent;
}
