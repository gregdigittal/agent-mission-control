import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig, SUPABASE_SERVICE_ROLE_KEY } from '../config.js';

let client: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (client) return client;

  const config = await loadConfig();
  if (!config.supabase.enabled || !config.supabase.anon_key) {
    return null;
  }

  client = createClient(config.supabase.url, config.supabase.anon_key);
  return client;
}

export function resetClient(): void {
  client = null;
  adminClient = null;
}

/**
 * Returns a Supabase client using the service role key.
 * For server-side writes (bridge scanner, backlog import) that bypass RLS.
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is not set.
 */
export async function getSupabaseAdminClient(): Promise<SupabaseClient | null> {
  if (adminClient) return adminClient;

  const config = await loadConfig();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  adminClient = createClient(config.supabase.url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return adminClient;
}
