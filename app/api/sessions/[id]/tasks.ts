/**
 * POST /api/sessions/:id/tasks
 *
 * Queues a create_task command for the bridge targeting the given session.
 *
 * Auth: Authorization: Bearer <AGENT_MC_API_SECRET>
 *
 * Body: { title: string; description?: string; priority?: 'high' | 'medium' | 'low' }
 * Response: { taskId: string; commandId: string; status: 'queued' }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { validateBearerToken, requireJsonContentType } from '../../_auth.ts';
import { writeCommand, generateCommandId } from '../../_commands.ts';

const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!validateBearerToken(req, res)) return;
  if (!requireJsonContentType(req, res)) return;

  const sessionId = req.query['id'];
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    res.status(400).json({ error: 'Missing session id' });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const title = body['title'];
  const description = body['description'];
  const priority = body['priority'];

  if (typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'Missing required field: title' });
    return;
  }

  if (description !== undefined && typeof description !== 'string') {
    res.status(400).json({ error: 'Invalid field: description must be a string' });
    return;
  }

  if (priority !== undefined && !VALID_PRIORITIES.has(priority as string)) {
    res.status(400).json({ error: 'Invalid field: priority must be high, medium, or low' });
    return;
  }

  const taskId = randomBytes(16).toString('hex');
  const commandId = generateCommandId();

  try {
    await writeCommand({
      type: 'create_task',
      commandId,
      sessionId: sessionId.trim(),
      title: title.trim(),
      ...(description !== undefined ? { description } : {}),
      ...(priority !== undefined ? { priority: priority as 'high' | 'medium' | 'low' } : {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions/:id/tasks] Failed to write create_task command for session ${sessionId}: ${message}`);
    res.status(500).json({ error: 'Failed to queue task creation command' });
    return;
  }

  res.status(200).json({ taskId, commandId, status: 'queued' });
}
