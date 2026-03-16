#!/usr/bin/env node

/**
 * agent-bridge-remote — Lightweight bridge for remote VPS nodes.
 *
 * Architectural constraints (same as primary bridge):
 * - ZERO network listeners — no http.createServer, no net.listen, no app.listen
 * - Filesystem IPC only — state written to ~/.agent-mc-remote/state/
 * - Atomic writes — all JSON state files use .tmp then rename
 * - Audit logs — append-only JSONL, never truncated
 * - Communicates back to primary bridge via rsync (primary polls; remote never pushes over TCP)
 *
 * Usage:
 *   agent-bridge-remote               # Run with ~/.agent-mc-remote/config.json
 *   agent-bridge-remote --init <id>   # Generate default config
 */

import { ensureDirectories, loadConfig, writeDefaultConfig } from './config.js';
import { audit } from './audit/logger.js';
import { writeAgentState, writeHeartbeat } from './state/writer.js';

let running = true;
let loopCount = 0;

async function init(): Promise<void> {
  const initIdx = process.argv.indexOf('--init');
  if (initIdx !== -1) {
    const nodeId = process.argv[initIdx + 1] ?? 'remote-node-1';
    const nodeLabel = process.argv[initIdx + 2] ?? nodeId;
    await ensureDirectories();
    await writeDefaultConfig(nodeId, nodeLabel);
    console.log(`Initialized ~/.agent-mc-remote/`);
    console.log(`  Config: ~/.agent-mc-remote/config.json`);
    console.log(`\nEdit config.json then run: agent-bridge-remote`);
    process.exit(0);
  }

  await ensureDirectories();
  const config = await loadConfig();

  console.log('┌─────────────────────────────────────────┐');
  console.log('│   Agent Mission Control — Remote Bridge  │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│  Node:     ${config.node_id}`);
  console.log(`│  Label:    ${config.node_label}`);
  console.log(`│  Loop:     ${config.loop_interval_ms}ms`);
  console.log('└─────────────────────────────────────────┘');

  await audit('bridge_remote_started', { nodeId: config.node_id, pid: process.pid });
}

async function loop(): Promise<void> {
  const config = await loadConfig();

  try {
    // Write heartbeat (primary bridge reads this via rsync)
    await writeHeartbeat(config.node_id);

    // Write agent state snapshot — primary bridge polls and aggregates
    // In production, this reads from locally running claude-code state files
    await writeAgentState({
      nodeId: config.node_id,
      agents: [], // populated when agents are spawned on this node
      timestamp: new Date().toISOString(),
    });

    loopCount++;
    if (loopCount % 12 === 0) { // ~60s at 5s intervals
      console.log(`[loop] #${loopCount} | node ${config.node_id}`);
    }
  } catch (err) {
    console.error('[loop] Error:', err);
    await audit('loop_error', { loopCount, error: String(err) });
  }
}

async function shutdown(signal: string): Promise<void> {
  if (!running) return;
  running = false;

  const config = await loadConfig().catch(() => ({ node_id: 'unknown' }));
  console.log(`\n[shutdown] Received ${signal}`);
  await audit('bridge_remote_stopped', { signal, nodeId: config.node_id, loopCount });
  console.log('[shutdown] Clean exit.');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

(async () => {
  try {
    await init();
    const config = await loadConfig();
    console.log(`[bridge-remote] Running every ${config.loop_interval_ms}ms. Press Ctrl+C to stop.\n`);

    while (running) {
      await loop();
      await new Promise((resolve) => setTimeout(resolve, config.loop_interval_ms));
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
