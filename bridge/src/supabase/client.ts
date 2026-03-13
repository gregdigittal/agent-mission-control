import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../config.js';

let client: SupabaseClient | null = null;

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
}
