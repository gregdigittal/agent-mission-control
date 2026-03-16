import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { APPROVALS_DIR, AGENT_KEY, SESSION_ID, AUDIT_FILE } from '../config.js';
import { readJsonFile } from '../state/reader.js';
import { writeJsonAtomic, appendJsonLine } from '../state/writer.js';

type RiskLevel = 'green' | 'yellow' | 'red';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

interface ApprovalRecord {
  id: string;
  agentKey: string;
  sessionId: string;
  action: string;
  riskLevel: RiskLevel;
  details: string;
  filesAffected: string[];
  status: ApprovalStatus;
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

const POLL_INTERVAL_MS = 2000;
const RED_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max wait

export function registerApprovalTools(server: McpServer): void {
  // ── mc_request_approval ────────────────────────────────────────────────────
  server.registerTool(
    'mc_request_approval',
    {
      description:
        'Request human approval before performing an action. ' +
        'Green = auto-approved. Yellow = queued, continues after brief wait. ' +
        'Red = BLOCKS until human approves or rejects.',
      inputSchema: {
        action: z.string().describe('Short name of the action requiring approval'),
        risk_level: z.enum(['green', 'yellow', 'red']).describe(
          'green=auto-approve, yellow=queue+continue, red=block until human decides',
        ),
        details: z.string().describe('Full description of what will happen'),
        files_affected: z.array(z.string()).optional().describe('Files that will be modified'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const id = randomBytes(8).toString('hex');
      const now = new Date().toISOString();

      // Green: auto-approve immediately
      if (args.risk_level === 'green') {
        await appendJsonLine(AUDIT_FILE, {
          ts: now, level: 'info', event: 'approval.auto',
          agentKey: AGENT_KEY, data: { id, action: args.action, riskLevel: 'green' },
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ approved: true, wait: false, id }) }],
        };
      }

      // Write approval record
      const record: ApprovalRecord = {
        id,
        agentKey: AGENT_KEY,
        sessionId: SESSION_ID,
        action: args.action,
        riskLevel: args.risk_level,
        details: args.details,
        filesAffected: args.files_affected ?? [],
        status: 'pending',
        createdAt: now,
      };

      const approvalPath = join(APPROVALS_DIR, `${id}.json`);
      await writeJsonAtomic(approvalPath, record);
      await appendJsonLine(AUDIT_FILE, {
        ts: now, level: 'info', event: 'approval.requested',
        agentKey: AGENT_KEY, data: { id, action: args.action, riskLevel: args.risk_level },
      });

      // Yellow: queue and continue (don't wait)
      if (args.risk_level === 'yellow') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ approved: true, wait: false, id }) }],
        };
      }

      // Red: poll until resolved or timeout
      const deadline = Date.now() + RED_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        const updated = await readJsonFile<ApprovalRecord>(approvalPath, record);
        if (updated.status === 'approved') {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ approved: true, wait: false, id }) }],
          };
        }
        if (updated.status === 'rejected') {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              approved: false, wait: false, id,
              reason: updated.rejectionReason ?? 'Rejected by operator',
            }) }],
          };
        }
      }

      // Timed out — mark expired and reject
      await writeJsonAtomic(approvalPath, { ...record, status: 'expired', resolvedAt: new Date().toISOString() });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          approved: false, wait: false, id, reason: 'Approval timed out (5 min)',
        }) }],
      };
    },
  );

  // ── mc_check_approval ──────────────────────────────────────────────────────
  server.registerTool(
    'mc_check_approval',
    {
      description: 'Check the status of a previously submitted approval request.',
      inputSchema: {
        request_id: z.string().describe('Approval request ID returned by mc_request_approval'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const approvalPath = join(APPROVALS_DIR, `${args.request_id}.json`);
      const record = await readJsonFile<ApprovalRecord | null>(approvalPath, null);

      if (!record) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Approval request not found' }) }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          status: record.status,
          reason: record.rejectionReason,
        }) }],
      };
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
