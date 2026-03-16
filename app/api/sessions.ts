/**
 * POST /api/sessions
 *
 * Queues a spawn command for the bridge to pick up, which will
 * create a new Claude Code agent session in the specified repo.
 *
 * Auth: Authorization: Bearer <AGENT_MC_API_SECRET>
 *
 * Body: { objective: string; repoPath: string; model?: string; maxTurns?: number }
 * Response: { sessionId: string; commandId: string; status: 'queued' }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { validateBearerToken, requireJsonContentType } from './_auth.ts';
import { writeCommand, generateCommandId } from './_commands.ts';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!validateBearerToken(req, res)) return;
  if (!requireJsonContentType(req, res)) return;

  const body = req.body as Record<string, unknown>;

  const objective = body['objective'];
  const repoPath = body['repoPath'];
  const model = body['model'];
  const maxTurns = body['maxTurns'];

  if (typeof objective !== 'string' || objective.trim() === '') {
    res.status(400).json({ error: 'Missing required field: objective' });
    return;
  }

  if (typeof repoPath !== 'string' || repoPath.trim() === '') {
    res.status(400).json({ error: 'Missing required field: repoPath' });
    return;
  }

  if (model !== undefined && typeof model !== 'string') {
    res.status(400).json({ error: 'Invalid field: model must be a string' });
    return;
  }

  if (maxTurns !== undefined && typeof maxTurns !== 'number') {
    res.status(400).json({ error: 'Invalid field: maxTurns must be a number' });
    return;
  }

  const sessionId = randomBytes(16).toString('hex');
  const commandId = generateCommandId();

  try {
    await writeCommand({
      type: 'spawn',
      commandId,
      objective: objective.trim(),
      repoPath: repoPath.trim(),
      ...(model !== undefined ? { model } : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions] Failed to write spawn command: ${message}`);
    res.status(500).json({ error: 'Failed to queue session spawn command' });
    return;
  }

  res.status(200).json({ sessionId, commandId, status: 'queued' });
}
