/**
 * /api/sessions
 *
 * POST — queue a spawn command to create a new agent session
 * GET  — list sessions with cursor-based pagination
 *
 * Auth: Authorization: Bearer <AGENT_MC_API_SECRET>
 *
 * GET query params:
 *   limit  — number of sessions to return (1–100, default 20)
 *   cursor — opaque pagination cursor (ISO timestamp of the last seen row)
 *   status — filter by session status (optional)
 *
 * POST body: { objective: string; repoPath: string; model?: string; maxTurns?: number }
 * POST response: { sessionId: string; commandId: string; status: 'queued' }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateBearerToken, requireJsonContentType } from './_auth.ts';
import { writeCommand, generateCommandId } from './_commands.ts';
import { defaultLimiter } from './_ratelimit.ts';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 100;

function getSupabaseServiceClient() {
  const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service configuration is missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!defaultLimiter.check(req, res)) return;
  if (!validateBearerToken(req, res)) return;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rawLimit  = req.query['limit'];
  const rawCursor = req.query['cursor'];
  const rawStatus = req.query['status'];

  const limitNum = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(typeof rawLimit === 'string' ? rawLimit : String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );
  const cursor = typeof rawCursor === 'string' ? rawCursor : undefined;
  const status = typeof rawStatus === 'string' ? rawStatus : undefined;

  let supabase;
  try {
    supabase = getSupabaseServiceClient();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions GET] Supabase config error: ${message}`);
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  // Fetch one extra to determine if there are more pages.
  let query = supabase
    .from('agent_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitNum + 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (cursor) {
    // Cursor is the created_at timestamp of the last seen item.
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[api/sessions GET] Query error: ${error.message}`);
    res.status(500).json({ error: 'Failed to list sessions' });
    return;
  }

  const rows = data ?? [];
  const hasMore = rows.length > limitNum;
  const items = hasMore ? rows.slice(0, limitNum) : rows;

  // Next cursor is the created_at of the last item returned.
  const nextCursor = hasMore && items.length > 0
    ? (items[items.length - 1] as Record<string, unknown>)['created_at'] as string
    : null;

  res.status(200).json({ items, nextCursor, hasMore });
}

// ── POST ──────────────────────────────────────────────────────────────────────

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireJsonContentType(req, res)) return;

  const body = req.body as Record<string, unknown>;

  const objective = body['objective'];
  const repoPath  = body['repoPath'];
  const model     = body['model'];
  const maxTurns  = body['maxTurns'];

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
      ...(model    !== undefined ? { model }    : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions POST] Failed to write spawn command: ${message}`);
    res.status(500).json({ error: 'Failed to queue session spawn command' });
    return;
  }

  res.status(200).json({ sessionId, commandId, status: 'queued' });
}
