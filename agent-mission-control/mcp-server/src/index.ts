#!/usr/bin/env node
/**
 * Agent Mission Control — MCP Server
 *
 * Enables Claude Code agents to push session state, tasks, and events
 * to the Agent Mission Control dashboard via Supabase.
 *
 * Transport: stdio (designed to run as a Claude Code subprocess)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  getState,
  getSessionId,
  reportSession,
  createTasks,
  updateTask,
  assignTask,
  requestApproval,
  reportMetrics,
  pushEvent,
} from "./state-manager.js";

// ── Server instance ──────────────────────────────────────────

const server = new McpServer({
  name: "agent-mission-control",
  version: "1.0.0",
});

// ── Tool: amc_report_session ─────────────────────────────────

server.tool(
  "amc_report_session",
  "Initialize or update the dashboard session. Call this first to set up project name, pipeline stages, and agent roster. The dashboard will show the session immediately.",
  {
    project: z.string().describe("Project name shown in the dashboard header"),
    session_id: z
      .string()
      .optional()
      .describe("Explicit session ID. If omitted, derived from project name"),
    currentStageIdx: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Zero-based index of the currently active pipeline stage"),
    stages: z
      .array(
        z.object({
          name: z.string().describe("Stage label (e.g. 'Planning')"),
          desc: z.string().optional().describe("Short description"),
          status: z
            .enum(["completed", "active", "pending"])
            .describe("Stage status"),
        })
      )
      .optional()
      .describe("Pipeline stages shown in the progress bar"),
    agents: z
      .array(
        z.object({
          id: z.string().describe("Unique agent ID (e.g. 'agent-arch')"),
          name: z.string().describe("Display name (e.g. 'Architect')"),
          role: z.string().describe("Agent role description"),
          type: z
            .enum(["leader", "backend", "frontend", "tester", "reviewer"])
            .describe("Agent type for card styling"),
          status: z
            .enum(["working", "thinking", "idle", "error", "leader"])
            .describe("Current agent status"),
          icon: z.string().describe("Emoji icon for the agent card"),
          task: z
            .string()
            .optional()
            .describe("Current task description shown on the agent card"),
          taskId: z
            .string()
            .nullable()
            .optional()
            .describe("ID of the linked Kanban task"),
        })
      )
      .optional()
      .describe("Agent roster displayed as cards in the dashboard"),
  },
  async (params) => {
    const result = await reportSession(params);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: amc_create_tasks ───────────────────────────────────

server.tool(
  "amc_create_tasks",
  "Create one or more tasks in the Kanban board. Tasks appear as cards in the backlog column by default. Use this to seed the project backlog at the start of a session.",
  {
    tasks: z
      .array(
        z.object({
          id: z
            .string()
            .describe("Unique task ID (e.g. 't01', 'task-auth-setup')"),
          title: z.string().describe("Task title shown on the Kanban card"),
          status: z
            .enum(["backlog", "in-progress", "review", "done"])
            .optional()
            .describe("Initial status column (default: 'backlog')"),
          assignee: z
            .string()
            .optional()
            .describe("Agent name assigned to this task"),
          priority: z
            .enum(["high", "medium", "low"])
            .optional()
            .describe("Task priority (default: 'medium')"),
          deps: z
            .array(z.string())
            .optional()
            .describe("IDs of tasks this task depends on"),
          depOf: z
            .string()
            .nullable()
            .optional()
            .describe("ID of the parent task this is a dependency of"),
          rec: z
            .boolean()
            .optional()
            .describe("Flag for recommendation/approval needed"),
          recWhy: z
            .string()
            .optional()
            .describe("Reason why approval is recommended"),
        })
      )
      .describe("Array of tasks to create or upsert"),
  },
  async (params) => {
    const result = await createTasks(params.tasks);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: amc_update_task ────────────────────────────────────

server.tool(
  "amc_update_task",
  "Update a single task's status, priority, or other fields. Use this to move tasks across Kanban columns (e.g. backlog → in-progress → review → done).",
  {
    id: z.string().describe("Task ID to update"),
    status: z
      .enum(["backlog", "in-progress", "review", "done"])
      .optional()
      .describe("New status (moves the card to that Kanban column)"),
    priority: z
      .enum(["high", "medium", "low"])
      .optional()
      .describe("New priority level"),
    title: z.string().optional().describe("Updated task title"),
    deps: z
      .array(z.string())
      .optional()
      .describe("Updated dependency list"),
    depOf: z
      .string()
      .nullable()
      .optional()
      .describe("Updated parent task ID"),
    rec: z
      .boolean()
      .optional()
      .describe("Set true to flag for approval"),
    recWhy: z
      .string()
      .optional()
      .describe("Reason for the approval recommendation"),
  },
  async (params) => {
    const result = await updateTask(params);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: amc_assign_task ────────────────────────────────────

server.tool(
  "amc_assign_task",
  "Assign a task to an agent (bidirectional link). The agent card shows the task title, and the Kanban card shows the agent as assignee.",
  {
    task_id: z.string().describe("Task ID to assign"),
    agent_id: z.string().describe("Agent ID to assign the task to"),
  },
  async (params) => {
    const result = await assignTask(params);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: amc_request_approval ───────────────────────────────

server.tool(
  "amc_request_approval",
  "Flag a task for human approval. Shows a recommendation badge on the Kanban card with the reason. Use when an agent wants human sign-off before proceeding.",
  {
    task_id: z.string().describe("Task ID to flag for approval"),
    reason: z
      .string()
      .describe(
        "Human-readable reason why approval is needed (e.g. 'Database schema change requires review')"
      ),
  },
  async (params) => {
    const result = await requestApproval(params);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: amc_report_metrics ─────────────────────────────────

server.tool(
  "amc_report_metrics",
  "Update an agent's live metrics displayed on its card. Report context window usage, cost, message count, and optionally update the agent's status or current task description.",
  {
    agent_id: z.string().describe("Agent ID to update metrics for"),
    ctx: z
      .string()
      .optional()
      .describe("Context window usage (e.g. '42%', '128k/200k')"),
    cost: z
      .string()
      .optional()
      .describe("Running cost (e.g. '$0.83', '$12.50')"),
    msgs: z
      .number()
      .int()
      .optional()
      .describe("Total message count"),
    status: z
      .enum(["working", "thinking", "idle", "error", "leader"])
      .optional()
      .describe("Updated agent status"),
    task: z
      .string()
      .optional()
      .describe("Updated current task description on the agent card"),
  },
  async (params) => {
    const result = await reportMetrics(params);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: amc_push_event ─────────────────────────────────────

server.tool(
  "amc_push_event",
  "Add one or more entries to the real-time activity feed. Events appear in the scrolling feed panel with agent name, type icon, and timestamp.",
  {
    events: z
      .array(
        z.object({
          agent: z
            .string()
            .describe(
              "Agent name or 'system' for system events"
            ),
          type: z
            .enum(["tool", "file", "task", "message", "thinking", "error"])
            .describe("Event type (determines the icon shown)"),
          text: z
            .string()
            .describe("Event description text"),
          timestamp: z
            .string()
            .optional()
            .describe(
              "HH:MM:SS timestamp. If omitted, current time is used"
            ),
        })
      )
      .describe("Array of events to add to the activity feed"),
  },
  async (params) => {
    const result = await pushEvent(params.events);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Start server ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Mission Control MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
