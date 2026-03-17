/**
 * /api/sessions/:id
 *
 * GET    — read session state from Supabase
 * DELETE — terminate a session (writes a terminate command for the bridge)
 * PATCH  — update session metadata (status, objective)
 *
 * Auth: Authorization: Bearer <AGENT_MC_API_SECRET>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateBearerToken, requireJsonContentType } from '../_auth.ts';
import { writeCommand, generateCommandId } from '../_commands.ts';
import { defaultLimiter } from '../_ratelimit.ts';

function getSupabaseServiceClient() {
  const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service configuration is missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!defaultLimiter.check(req, res)) return;
  if (!validateBearerToken(req, res)) return;

  const id = req.query['id'];
  if (typeof id !== 'string' || id.trim() === '') {
    res.status(400).json({ error: 'Missing session id' });
    return;
  }
  const sessionId = id.trim();

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, sessionId);
    case 'DELETE':
      return handleDelete(req, res, sessionId);
    case 'PATCH':
      return handlePatch(req, res, sessionId);
    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

async function handleGet(_req: VercelRequest, res: VercelResponse, sessionId: string): Promise<void> {
  let supabase;
  try {
    supabase = getSupabaseServiceClient();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions/:id GET] Supabase config error: ${message}`);
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    console.error(`[api/sessions/:id GET] Query error for session ${sessionId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve session' });
    return;
  }

  if (!data) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.status(200).json(data);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

async function handleDelete(_req: VercelRequest, res: VercelResponse, sessionId: string): Promise<void> {
  const commandId = generateCommandId();

  try {
    await writeCommand({
      type: 'terminate',
      commandId,
      sessionId,
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions/:id DELETE] Failed to write terminate command: ${message}`);
    res.status(500).json({ error: 'Failed to queue session termination' });
    return;
  }

  res.status(200).json({ sessionId, commandId, status: 'terminating' });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

async function handlePatch(req: VercelRequest, res: VercelResponse, sessionId: string): Promise<void> {
  if (!requireJsonContentType(req, res)) return;

  const body = req.body as Record<string, unknown>;
  const { status, objective } = body;

  if (status !== undefined && typeof status !== 'string') {
    res.status(400).json({ error: 'Invalid field: status must be a string' });
    return;
  }

  if (objective !== undefined && typeof objective !== 'string') {
    res.status(400).json({ error: 'Invalid field: objective must be a string' });
    return;
  }

  if (status === undefined && objective === undefined) {
    res.status(400).json({ error: 'At least one of status or objective is required' });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseServiceClient();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions/:id PATCH] Supabase config error: ${message}`);
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined)    updates['status']    = status;
  if (objective !== undefined) updates['objective'] = objective;

  const { data, error } = await supabase
    .from('agent_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    console.error(`[api/sessions/:id PATCH] Update error for session ${sessionId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to update session' });
    return;
  }

  res.status(200).json(data);
}
