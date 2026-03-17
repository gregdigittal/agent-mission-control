/**
 * POST /api/webhooks/bridge
 *
 * Reverse webhook endpoint — the bridge daemon calls this when an agent session
 * completes. Updates the GitHub commit status check to reflect the review outcome.
 *
 * Auth: shared AGENT_MC_API_SECRET (same Bearer token used by the bridge commands API)
 *
 * Body:
 *   {
 *     sessionId:  string;       — the session that just completed
 *     event:      string;       — e.g. "agent_exited", "explore_winner_ready"
 *     exitCode?:  number;       — agent process exit code (0 = success)
 *     commitSha?: string;       — SHA to update the GitHub status for
 *     repoName?:  string;       — owner/repo (e.g. "gregmorris/agent-mission-control")
 *     summary?:   string;       — brief review summary to include in the status description
 *   }
 *
 * Required env vars:
 *   AGENT_MC_API_SECRET    — shared auth secret
 *   GITHUB_STATUS_TOKEN    — GitHub token with statuses:write scope
 *                            (typically a fine-grained PAT — NOT the workflow GITHUB_TOKEN)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateBearerToken, requireJsonContentType } from '../_auth.ts';

const GITHUB_API = 'https://api.github.com';

// ── Types ─────────────────────────────────────────────────────────────────────

type BridgeWebhookPayload = {
  sessionId: string;
  event: string;
  exitCode?: number;
  commitSha?: string;
  repoName?: string;
  summary?: string;
};

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!validateBearerToken(req, res)) return;
  if (!requireJsonContentType(req, res)) return;

  const body = req.body as Record<string, unknown>;
  const payload = extractPayload(body);

  if (!payload) {
    res.status(400).json({ error: 'Missing required field: sessionId and event are required' });
    return;
  }

  // If we have enough context to update a GitHub commit status, do it.
  if (payload.commitSha && payload.repoName) {
    const githubToken = process.env['GITHUB_STATUS_TOKEN'];
    if (!githubToken) {
      console.warn('[webhooks/bridge] GITHUB_STATUS_TOKEN not set — skipping commit status update');
    } else {
      await updateGitHubStatus(payload, githubToken);
    }
  }

  console.log(
    `[webhooks/bridge] Received event '${payload.event}' for session ${payload.sessionId}` +
    (payload.commitSha ? ` (commit ${payload.commitSha.slice(0, 8)})` : ''),
  );

  res.status(200).json({ ok: true, sessionId: payload.sessionId });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPayload(body: Record<string, unknown>): BridgeWebhookPayload | null {
  const sessionId = body['sessionId'];
  const event     = body['event'];

  if (typeof sessionId !== 'string' || typeof event !== 'string') return null;

  return {
    sessionId,
    event,
    exitCode:  typeof body['exitCode']  === 'number' ? body['exitCode']  : undefined,
    commitSha: typeof body['commitSha'] === 'string' ? body['commitSha'] : undefined,
    repoName:  typeof body['repoName']  === 'string' ? body['repoName']  : undefined,
    summary:   typeof body['summary']   === 'string' ? body['summary']   : undefined,
  };
}

/** Map a bridge event + exit code to a GitHub commit status state. */
function resolveState(payload: BridgeWebhookPayload): 'success' | 'failure' | 'error' {
  if (payload.event === 'agent_exited') {
    return payload.exitCode === 0 ? 'success' : 'failure';
  }
  // Other events (explore_winner_ready, etc.) are treated as informational success
  return 'success';
}

async function updateGitHubStatus(
  payload: BridgeWebhookPayload,
  githubToken: string,
): Promise<void> {
  const state = resolveState(payload);
  const maxDescLen = 140; // GitHub status description limit
  const description = payload.summary
    ? payload.summary.slice(0, maxDescLen)
    : state === 'success'
      ? 'Agent review completed successfully'
      : 'Agent review completed with errors — check the dashboard';

  const url = `${GITHUB_API}/repos/${payload.repoName}/statuses/${payload.commitSha}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        state,
        context: 'agent-mission-control/review',
        description,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `[webhooks/bridge] GitHub status update failed: ${response.status} ${response.statusText}`,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhooks/bridge] Failed to update GitHub commit status: ${message}`);
  }
}
