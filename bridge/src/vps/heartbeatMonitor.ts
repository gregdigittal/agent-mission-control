/**
 * Heartbeat monitor — polls registered VPS nodes on an interval.
 *
 * Uses SSH to run a lightweight 'uptime' command.
 * Uses setInterval — NOT a network server. The bridge remains zero-listener.
 * Heartbeat failures are logged to the audit log (append-only).
 * A single VPS being unreachable does NOT crash the bridge.
 */

import { audit } from '../audit/logger.js';
import { listVps } from './vpsRegistry.js';
import { runSshCommand } from './sshWrapper.js';
import type { HeartbeatResult } from './types.js';

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Latest heartbeat results — written by bridge, read by state aggregator
let lastResults: Map<string, HeartbeatResult> = new Map();

export function getHeartbeatResults(): HeartbeatResult[] {
  return Array.from(lastResults.values());
}

async function checkHeartbeat(supabaseSync?: (results: HeartbeatResult[]) => Promise<void>): Promise<void> {
  let nodes: Awaited<ReturnType<typeof listVps>>;
  try {
    nodes = await listVps();
  } catch (err) {
    await audit('heartbeat_registry_error', { error: String(err) });
    return;
  }

  if (nodes.length === 0) return;

  const results = await Promise.allSettled(
    nodes.map(async (vps): Promise<HeartbeatResult> => {
      const startMs = Date.now();
      try {
        const result = await runSshCommand(vps, { command: 'uptime' });
        const latencyMs = Date.now() - startMs;
        const status = result.status === 'ok' ? 'ok' : result.status === 'timeout' ? 'timeout' : 'unreachable';

        const heartbeat: HeartbeatResult = {
          vpsId: vps.id,
          host: vps.host,
          status,
          latencyMs,
          checkedAt: new Date().toISOString(),
          ...(result.status !== 'ok' ? { error: result.stderr || 'SSH failed' } : {}),
        };

        await audit('heartbeat', {
          vpsId: vps.id,
          host: vps.host,
          status,
          latencyMs,
        });

        if (status !== 'ok') {
          console.warn(`[heartbeat] ${vps.label} (${vps.host}) is ${status} — ${result.stderr}`);
        }

        return heartbeat;
      } catch (err) {
        // Never crash the bridge on a single VPS failure
        const latencyMs = Date.now() - startMs;
        await audit('heartbeat_error', { vpsId: vps.id, host: vps.host, error: String(err) });
        return {
          vpsId: vps.id,
          host: vps.host,
          status: 'unreachable',
          latencyMs,
          checkedAt: new Date().toISOString(),
          error: String(err),
        };
      }
    }),
  );

  const heartbeats: HeartbeatResult[] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : {
      vpsId: 'unknown',
      host: 'unknown',
      status: 'unreachable' as const,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    },
  );

  // Update in-memory cache (read by state aggregator)
  lastResults = new Map(heartbeats.map((h) => [h.vpsId, h]));

  // Optional: push results to Supabase for dashboard
  if (supabaseSync) {
    try {
      await supabaseSync(heartbeats);
    } catch (err) {
      await audit('heartbeat_sync_error', { error: String(err) });
    }
  }
}

/**
 * Start the heartbeat monitor.
 * Fires once immediately, then on the configured interval.
 * A no-op if already running.
 */
export function startHeartbeatMonitor(
  supabaseSync?: (results: HeartbeatResult[]) => Promise<void>,
): void {
  if (heartbeatTimer !== null) return;

  // Fire immediately, then on interval
  void checkHeartbeat(supabaseSync);
  heartbeatTimer = setInterval(() => void checkHeartbeat(supabaseSync), HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeatMonitor(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
