import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { INBOX_DIR, AGENT_KEY, SESSION_ID, AUDIT_FILE } from '../config.js';
import { appendJsonLine } from '../state/writer.js';

interface Message {
  id: string;
  from: string;
  to: string;
  message: string;
  ts: string;
}

export function registerMessagingTools(server: McpServer): void {
  // ── mc_send_message ────────────────────────────────────────────────────────
  server.registerTool(
    'mc_send_message',
    {
      description: 'Send a message to another agent\'s inbox.',
      inputSchema: {
        to_agent: z.string().describe('Target agent key (e.g. "frontend", "backend")'),
        message: z.string().describe('Message content'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const id = randomBytes(8).toString('hex');
      const ts = new Date().toISOString();

      const msg: Message = {
        id,
        from: AGENT_KEY,
        to: args.to_agent,
        message: args.message,
        ts,
      };

      const inboxDir = join(INBOX_DIR, args.to_agent);
      await mkdir(inboxDir, { recursive: true });
      await writeFile(join(inboxDir, `${id}.json`), JSON.stringify(msg), 'utf-8');

      await appendJsonLine(AUDIT_FILE, {
        ts, level: 'info', event: 'message.sent',
        agentKey: AGENT_KEY, sessionId: SESSION_ID,
        data: { id, to: args.to_agent },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id, ts, delivered: true }) }],
      };
    },
  );

  // ── mc_read_messages ───────────────────────────────────────────────────────
  server.registerTool(
    'mc_read_messages',
    {
      description: 'Read and clear this agent\'s message inbox.',
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async () => {
      const inboxDir = join(INBOX_DIR, AGENT_KEY);
      let files: string[];

      try {
        const { readdir } = await import('node:fs/promises');
        files = (await readdir(inboxDir)).filter((f) => f.endsWith('.json'));
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] };
        }
        throw err;
      }

      const messages: Message[] = [];
      for (const file of files) {
        const path = join(inboxDir, file);
        try {
          const raw = await readFile(path, 'utf-8');
          messages.push(JSON.parse(raw) as Message);
          // Delete after reading (inbox cleared)
          await unlink(path);
        } catch {
          // Skip unreadable files
        }
      }

      // Sort by timestamp
      messages.sort((a, b) => a.ts.localeCompare(b.ts));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(messages) }],
      };
    },
  );
}
