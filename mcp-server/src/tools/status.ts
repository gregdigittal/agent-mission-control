import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { join } from 'node:path';
import { AGENT_KEY, SESSION_ID, AGENTS_DIR, BUDGET_CENTS } from '../config.js';
import { writeJsonAtomic, appendJsonLine } from '../state/writer.js';
import { readJsonDir } from '../state/reader.js';
import { AUDIT_FILE } from '../config.js';

interface AgentState {
  agentKey: string;
  sessionId: string;
  status: string;
  task: string;
  contextPct: number;
  files: string[];
  updatedAt: string;
}

interface CostRecord {
  agentKey: string;
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  updatedAt: string;
}

export function registerStatusTools(server: McpServer): void {
  // ── mc_report_status ───────────────────────────────────────────────────────
  server.registerTool(
    'mc_report_status',
    {
      description: 'Report this agent\'s current status, task, and context usage to Mission Control.',
      inputSchema: {
        status: z.enum(['idle', 'running', 'waiting_approval', 'paused', 'error', 'complete'])
          .describe('Current agent status'),
        task: z.string().describe('Current task description'),
        context_pct: z.number().min(0).max(100).describe('Context window usage percentage'),
        files: z.array(z.string()).optional().describe('Files currently being worked on'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const state: AgentState = {
        agentKey: AGENT_KEY,
        sessionId: SESSION_ID,
        status: args.status,
        task: args.task,
        contextPct: args.context_pct,
        files: args.files ?? [],
        updatedAt: new Date().toISOString(),
      };

      const statePath = join(AGENTS_DIR, `${AGENT_KEY}.json`);
      await writeJsonAtomic(statePath, state);
      await appendJsonLine(AUDIT_FILE, {
        ts: state.updatedAt, level: 'info', event: 'agent.status',
        agentKey: AGENT_KEY, sessionId: SESSION_ID,
        data: { status: args.status, task: args.task },
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, agentKey: AGENT_KEY, updatedAt: state.updatedAt }),
        }],
      };
    },
  );

  // ── mc_report_cost ─────────────────────────────────────────────────────────
  server.registerTool(
    'mc_report_cost',
    {
      description: 'Report token usage and cost for this agent. Returns budget status.',
      inputSchema: {
        input_tokens: z.number().int().min(0).describe('Input tokens used in this call'),
        output_tokens: z.number().int().min(0).describe('Output tokens used in this call'),
        cost_cents: z.number().min(0).describe('Cost of this call in USD cents'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const costPath = join(AGENTS_DIR, `${AGENT_KEY}.cost.json`);
      const existing = await import('../state/reader.js').then((m) =>
        m.readJsonFile<CostRecord>(costPath, {
          agentKey: AGENT_KEY, sessionId: SESSION_ID,
          totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0,
          updatedAt: '',
        }),
      );

      const updated: CostRecord = {
        agentKey: AGENT_KEY,
        sessionId: SESSION_ID,
        totalInputTokens: existing.totalInputTokens + args.input_tokens,
        totalOutputTokens: existing.totalOutputTokens + args.output_tokens,
        totalCostCents: existing.totalCostCents + args.cost_cents,
        updatedAt: new Date().toISOString(),
      };

      await writeJsonAtomic(costPath, updated);
      await appendJsonLine(AUDIT_FILE, {
        ts: updated.updatedAt, level: 'info', event: 'agent.cost',
        agentKey: AGENT_KEY, sessionId: SESSION_ID,
        data: { input_tokens: args.input_tokens, output_tokens: args.output_tokens, cost_cents: args.cost_cents },
      });

      const budgetRemainingCents = BUDGET_CENTS > 0
        ? BUDGET_CENTS - updated.totalCostCents
        : null;

      const budgetStatus = BUDGET_CENTS <= 0 ? 'unlimited'
        : updated.totalCostCents / BUDGET_CENTS >= 0.95 ? 'critical'
        : updated.totalCostCents / BUDGET_CENTS >= 0.80 ? 'warning'
        : 'ok';

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total_cost_cents: updated.totalCostCents,
            budget_remaining_cents: budgetRemainingCents,
            budget_status: budgetStatus,
          }),
        }],
      };
    },
  );

  // ── mc_get_team_status ─────────────────────────────────────────────────────
  server.registerTool(
    'mc_get_team_status',
    {
      description: 'Get the current status of all agents in the team.',
      inputSchema: {
        session_id: z.string().optional().describe('Filter by session ID (omit for all sessions)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const agents = await readJsonDir<AgentState>(AGENTS_DIR);
      const filtered = args.session_id
        ? agents.filter((a) => a.sessionId === args.session_id)
        : agents;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(filtered),
        }],
      };
    },
  );
}
