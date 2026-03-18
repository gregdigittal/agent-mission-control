import { hostname } from 'node:os';
import { getSupabaseAdminClient } from '../supabase/client.js';
import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';
import { getNodeUuid } from './nodeId.js';

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
  const nodeUuid = await getNodeUuid();
  const nodeName = process.env['VPS_NODE_ID'] ?? hostname();
  const region = process.env['VPS_REGION'] ?? 'local';

  // user_id is the profile owner — required NOT NULL by schema.
  // For a single-tenant VPS setup this is always the dashboard owner's profile id.
  const userId = process.env['VPS_OWNER_USER_ID'] ?? 'a1b2c3d4-0000-0000-0000-000000000001';

  const { error } = await client.from('vps_nodes').upsert({
    id: nodeUuid,
    user_id: userId,
    name: nodeName,
    hostname: hostname(),
    status: 'online',
    current_agent_count: 0,
    max_concurrent_agents: config.max_agents,
    last_heartbeat: new Date().toISOString(),
    agent_bridge_version: '0.1.0',
    system_info: { region },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[vps] Node registration failed:', error.message);
    await audit('vps_registration_error', { nodeId: nodeUuid, nodeName, error: error.message });
  } else {
    console.log(`[vps] Registered as node: ${nodeName} (${nodeUuid}) region: ${region}`);
  }
}
