/**
 * GET /api/sessions/:id
 *
 * Reads session state from Supabase using the service-role key
 * (server-side only — never exposed to the browser).
 *
 * Auth: Authorization: Bearer <AGENT_MC_API_SECRET>
 *
 * Response: the agent_sessions row as JSON, or 404 if not found.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateBearerToken } from '../_auth.ts';

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
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!validateBearerToken(req, res)) return;

  const id = req.query['id'];
  if (typeof id !== 'string' || id.trim() === '') {
    res.status(400).json({ error: 'Missing session id' });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseServiceClient();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/sessions/:id] Supabase config error: ${message}`);
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('id', id.trim())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // PostgREST "no rows" error
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    console.error(`[api/sessions/:id] Supabase query error for session ${id}: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve session' });
    return;
  }

  if (!data) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.status(200).json(data);
}
