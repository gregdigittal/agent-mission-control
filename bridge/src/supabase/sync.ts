import { getSupabaseClient } from './client.js';
import { audit } from '../audit/logger.js';
import type { DashboardState } from '../state/aggregator.js';

let lastHeartbeat = 0;
const HEARTBEAT_INTERVAL_MS = 30_000;

export async function syncToSupabase(state: DashboardState): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;

  try {
    // Push agent states
    for (const session of state.sessions) {
      for (const agent of session.agents) {
        const { error } = await client.from('agents').upsert({
          session_id: session.id,
          agent_key: agent.key,
          name: agent.name,
          role: agent.role,
          agent_type: 'claude',
          status: agent.status,
          icon: agent.icon,
          current_task: agent.task,
          context_usage_pct: agent.ctx,
          cost_cents: agent.cost,
          message_count: agent.msgs,
          active_files: agent.files,
          pid: agent.pid,
          worktree_path: agent.worktreePath,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,agent_key' });

        if (error) {
          console.warn(`[supabase] Agent upsert error for ${agent.key}:`, error.message);
        }
      }

      // Update session totals
      const { error: sessionErr } = await client.from('agent_sessions').update({
        total_cost_cents: session.totalCost,
        updated_at: new Date().toISOString(),
      }).eq('id', session.id);

      if (sessionErr) {
        console.warn(`[supabase] Session update error:`, sessionErr.message);
      }
    }

    // Periodic heartbeat to vps_nodes
    const now = Date.now();
    if (now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = now;
      // This would update the vps_nodes table with heartbeat
      // Skipped if no vps_node record exists yet
    }
  } catch (err) {
    await audit('supabase_sync_error', { error: String(err) });
  }
}

export async function pullCommandsFromSupabase(): Promise<void> {
  // Future: pull pending commands from Supabase for remote dashboard access
  // For now, commands come through filesystem IPC
}
