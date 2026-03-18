import { hostname } from 'node:os';
import { getSupabaseAdminClient } from '../supabase/client.js';
import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';

/**
 * Registers this bridge instance as a VPS node in Supabase on startup.
 * Uses upsert so restarting the bridge updates rather than duplicates the record.
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set — silently skips if absent.
 */
export async function registerVpsNode(): Promise<void> {
  const client = await getSupabaseAdminClient();
  if (!client) {
    console.warn('[vps] SUPABASE_SERVICE_ROLE_KEY not set — node registration skipped');
    return;
  }

  const config = await loadConfig();
  const nodeId = process.env['VPS_NODE_ID'] ?? hostname();
  const region = process.env['VPS_REGION'] ?? 'local';

  const { error } = await client.from('vps_nodes').upsert({
    id: nodeId,
    name: nodeId,
    host: hostname(),
    region,
    health: 'healthy',
    agent_count: 0,
    agent_capacity: config.max_agents,
    last_heartbeat: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[vps] Node registration failed:', error.message);
    await audit('vps_registration_error', { nodeId, error: error.message });
  } else {
    console.log(`[vps] Registered as node: ${nodeId} (region: ${region})`);
  }
}
