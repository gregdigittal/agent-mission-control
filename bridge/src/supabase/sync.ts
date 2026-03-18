import { hostname } from 'node:os';
import { getSupabaseClient, getSupabaseAdminClient } from './client.js';
import { audit } from '../audit/logger.js';
import { executeCommand, CommandSchema } from '../commands/processor.js';
import type { DashboardState } from '../state/aggregator.js';

let lastHeartbeat = 0;
const HEARTBEAT_INTERVAL_MS = 30_000;

// Track which agents have already had a compaction alert fired this session.
// Prevents emitting a new event every sync cycle once threshold is crossed.
const alertedAgents = new Set<string>();
const CONTEXT_ALERT_THRESHOLD = 60;

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

        // Emit compaction alert event when context crosses threshold (once per agent)
        const alertKey = `${session.id}:${agent.key}`;
        if (agent.ctx >= CONTEXT_ALERT_THRESHOLD && !alertedAgents.has(alertKey)) {
          alertedAgents.add(alertKey);
          await audit('context_compaction_alert', {
            agentKey: agent.key,
            sessionId: session.id,
            contextPct: agent.ctx,
          });
          console.warn(`[context] Agent ${agent.key} context at ${agent.ctx}% — compaction recommended`);

          // Push to events table for realtime dashboard notification
          const { error: evErr } = await client.from('events').insert({
            agent_id: agent.key,
            session_id: session.id,
            type: 'cost_alert',
            message: `Context window at ${agent.ctx}% — consider running /compact`,
            detail: `Threshold: ${CONTEXT_ALERT_THRESHOLD}%. Current: ${agent.ctx}%.`,
            ts: new Date().toISOString(),
          });
          if (evErr) {
            console.warn(`[supabase] Context alert event error:`, evErr.message);
          }
        }
        // Clear alert tracking when context drops back below threshold (e.g. after compaction)
        if (agent.ctx < CONTEXT_ALERT_THRESHOLD && alertedAgents.has(alertKey)) {
          alertedAgents.delete(alertKey);
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
      const nodeId = process.env['VPS_NODE_ID'] ?? hostname();
      const agentCount = state.sessions.reduce((n, s) => n + s.agents.length, 0);
      const { error: hbErr } = await client.from('vps_nodes').update({
        last_heartbeat: new Date().toISOString(),
        agent_count: agentCount,
        health: 'healthy',
      }).eq('id', nodeId);
      if (hbErr) {
        console.warn(`[supabase] Heartbeat update error:`, hbErr.message);
      }
    }
  } catch (err) {
    await audit('supabase_sync_error', { error: String(err) });
  }
}

/**
 * Polls the Supabase `commands` table for pending commands and executes them.
 * Uses the admin (service role) client so RLS does not block reads.
 * Returns the number of commands successfully processed.
 */
export async function pullCommandsFromSupabase(): Promise<number> {
  const client = await getSupabaseAdminClient();
  if (!client) return 0;

  // Fetch pending commands, oldest first, capped at 20 per cycle
  const { data, error } = await client
    .from('commands')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    console.warn('[supabase:commands] Fetch error:', error.message);
    return 0;
  }
  if (!data || data.length === 0) return 0;

  let processed = 0;

  for (const row of data) {
    // Mark as processing (idempotency guard — prevents double-execution on overlapping loops)
    const { error: markErr } = await client
      .from('commands')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending');

    if (markErr) {
      console.warn(`[supabase:commands] Could not claim command ${row.id}:`, markErr.message);
      continue;
    }

    try {
      // Validate and normalise the raw row to the Command shape
      const parseResult = CommandSchema.safeParse({
        id: row.id,
        type: row.type,
        timestamp: row.created_at,
        session_token: row.session_token ?? '',
        payload: row.payload ?? {},
      });

      if (!parseResult.success) {
        const msg = parseResult.error.message;
        await client
          .from('commands')
          .update({ status: 'error', error: `Invalid command shape: ${msg}`, processed_at: new Date().toISOString() })
          .eq('id', row.id);
        await audit('supabase_command_invalid', { commandId: row.id, type: row.type, error: msg });
        console.warn(`[supabase:commands] Invalid command ${row.id} (${row.type}):`, msg);
        continue;
      }

      // Authentication for Supabase-sourced commands is handled by RLS on insert
      // (only authenticated users can insert). Skip local token validation.
      await executeCommand(parseResult.data);

      await client
        .from('commands')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', row.id);

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await client
        .from('commands')
        .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
        .eq('id', row.id);
      await audit('supabase_command_error', { commandId: row.id, type: row.type, error: message });
      console.error(`[supabase:commands] Failed to execute ${row.type} (${row.id}):`, message);
    }
  }

  return processed;
}
