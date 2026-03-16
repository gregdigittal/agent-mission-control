import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomBytes } from 'node:crypto';
import { AUDIT_FILE, AGENT_KEY, SESSION_ID } from '../config.js';
import { appendJsonLine } from '../state/writer.js';

export function registerEventTools(server: McpServer): void {
  // ── mc_log_event ───────────────────────────────────────────────────────────
  server.registerTool(
    'mc_log_event',
    {
      description: 'Write a structured event to the Mission Control audit trail.',
      inputSchema: {
        type: z.string().describe('Event type (e.g. "file.write", "test.pass", "deploy.start")'),
        description: z.string().describe('Human-readable description of what happened'),
        file: z.string().optional().describe('File path involved in this event'),
        metadata: z.record(z.string(), z.unknown()).optional().describe('Additional structured data'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const id = randomBytes(6).toString('hex');
      const ts = new Date().toISOString();

      await appendJsonLine(AUDIT_FILE, {
        ts, level: 'info', event: args.type,
        id, agentKey: AGENT_KEY, sessionId: SESSION_ID,
        description: args.description,
        file: args.file,
        metadata: args.metadata,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id, ts }) }],
      };
    },
  );
}
