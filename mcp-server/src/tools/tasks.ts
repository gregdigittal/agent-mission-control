import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TASKS_FILE, AGENT_KEY, AUDIT_FILE } from '../config.js';
import { readJsonFile } from '../state/reader.js';
import { writeJsonAtomic, appendJsonLine } from '../state/writer.js';

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  assignedAgent?: string;
  tags?: string[];
  recommendation?: string;
  createdAt: string;
  updatedAt: string;
}

// Valid state transitions (same machine as the React dashboard)
const VALID_TRANSITIONS: Record<KanbanStatus, KanbanStatus[]> = {
  backlog:     ['todo', 'blocked'],
  todo:        ['in_progress', 'blocked', 'backlog'],
  in_progress: ['review', 'blocked', 'todo'],
  review:      ['done', 'in_progress', 'blocked'],
  done:        [],
  blocked:     ['todo', 'in_progress', 'backlog'],
};

export function registerTaskTools(server: McpServer): void {
  // ── mc_get_tasks ───────────────────────────────────────────────────────────
  server.registerTool(
    'mc_get_tasks',
    {
      description: 'Read tasks from the Kanban board. Filter by column, assigned agent, or tag.',
      inputSchema: {
        column: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional()
          .describe('Filter by Kanban column'),
        assigned_to: z.string().optional().describe('Filter by assigned agent key'),
        tag: z.string().optional().describe('Filter by tag'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const tasks = await readJsonFile<Task[]>(TASKS_FILE, []);
      let result = tasks;

      if (args.column)      result = result.filter((t) => t.status === args.column);
      if (args.assigned_to) result = result.filter((t) => t.assignedAgent === args.assigned_to);
      if (args.tag)         result = result.filter((t) => t.tags?.includes(args.tag!));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    },
  );

  // ── mc_update_task ─────────────────────────────────────────────────────────
  server.registerTool(
    'mc_update_task',
    {
      description: 'Move or assign a Kanban task. State transitions are validated.',
      inputSchema: {
        task_id: z.string().describe('Task ID to update'),
        column: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional()
          .describe('New column to move the task to'),
        assigned_agent: z.string().optional().describe('Agent key to assign the task to'),
        recommendation: z.string().optional().describe('Agent\'s recommendation or note for this task'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const tasks = await readJsonFile<Task[]>(TASKS_FILE, []);
      const idx = tasks.findIndex((t) => t.id === args.task_id);

      if (idx === -1) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Task ${args.task_id} not found` }) }],
          isError: true,
        };
      }

      const task = tasks[idx]!;

      // Validate transition
      if (args.column && args.column !== task.status) {
        const allowed = VALID_TRANSITIONS[task.status];
        if (!allowed.includes(args.column)) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              error: `Invalid transition: ${task.status} → ${args.column}`,
              allowed,
            }) }],
            isError: true,
          };
        }
      }

      const updated: Task = {
        ...task,
        ...(args.column && { status: args.column }),
        ...(args.assigned_agent && { assignedAgent: args.assigned_agent }),
        ...(args.recommendation && { recommendation: args.recommendation }),
        updatedAt: new Date().toISOString(),
      };
      tasks[idx] = updated;

      await writeJsonAtomic(TASKS_FILE, tasks);
      await appendJsonLine(AUDIT_FILE, {
        ts: updated.updatedAt, level: 'info', event: 'task.updated',
        agentKey: AGENT_KEY, data: { taskId: args.task_id, changes: args },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(updated) }],
      };
    },
  );
}
