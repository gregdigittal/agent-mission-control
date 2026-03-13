#!/usr/bin/env node

/**
 * Agent Bridge — Hybrid orchestrator for Claude Code agent teams.
 *
 * Zero network listeners. Filesystem IPC only.
 * Optional Supabase sync for remote dashboard access.
 *
 * Usage:
 *   agent-bridge              # Run with ~/.agent-mc/config.json
 *   agent-bridge --init /path # Generate default config for repo
 */

import { ensureDirectories, loadConfig } from './config.js';
import { ensureSessionToken } from './security/token.js';
import { processCommands } from './commands/processor.js';
import { checkHealth } from './health/checker.js';
import { handleCrashedAgents } from './health/recovery.js';
import { aggregateState } from './state/aggregator.js';
import { writeDashboardState, writeHeartbeat } from './state/writer.js';
import { syncToSupabase } from './supabase/sync.js';
import { terminateAll } from './commands/terminate.js';
import { audit } from './audit/logger.js';
import { writeDefaultConfig } from './config.js';

let running = true;
let loopCount = 0;

async function init(): Promise<void> {
  // Handle --init flag
  const initIdx = process.argv.indexOf('--init');
  if (initIdx !== -1) {
    const repoPath = process.argv[initIdx + 1];
    if (!repoPath) {
      console.error('Usage: agent-bridge --init /path/to/repo');
      process.exit(1);
    }
    await ensureDirectories();
    await writeDefaultConfig(repoPath);
    const token = await ensureSessionToken();
    console.log('Initialized ~/.agent-mc/');
    console.log(`  Config: ~/.agent-mc/config.json`);
    console.log(`  Token:  ${token.slice(0, 8)}...`);
    console.log(`\nEdit config.json to configure, then run: agent-bridge`);
    process.exit(0);
  }

  await ensureDirectories();
  const token = await ensureSessionToken();
  const config = await loadConfig();

  console.log('┌─────────────────────────────────────┐');
  console.log('│   Agent Mission Control — Bridge     │');
  console.log('├─────────────────────────────────────┤');
  console.log(`│  Repo:     ${config.repo_path}`);
  console.log(`│  Loop:     ${config.loop_interval_ms}ms`);
  console.log(`│  Max agents: ${config.max_agents}`);
  console.log(`│  Supabase: ${config.supabase.enabled ? 'enabled' : 'disabled'}`);
  console.log(`│  Token:    ${token.slice(0, 8)}...`);
  console.log('└─────────────────────────────────────┘');

  await audit('bridge_started', {
    pid: process.pid,
    repoPath: config.repo_path,
    supabase: config.supabase.enabled,
  });
}

async function loop(): Promise<void> {
  const config = await loadConfig();

  try {
    // 1. Health Check
    const healthResults = await checkHealth();
    await handleCrashedAgents(healthResults);

    // 2. Command Processing
    const commandsProcessed = await processCommands();

    // 3. Status Aggregation
    const state = await aggregateState();
    await writeDashboardState(state);
    await writeHeartbeat();

    // 4. Supabase Sync (if enabled)
    if (config.supabase.enabled) {
      await syncToSupabase(state);
    }

    // Periodic logging
    loopCount++;
    if (loopCount % 30 === 0) { // Every ~60s at 2s intervals
      const agentCount = state.sessions.reduce((n, s) => n + s.agents.length, 0);
      console.log(`[loop] #${loopCount} | ${agentCount} agents | ${commandsProcessed} cmds`);
    }
  } catch (err) {
    console.error('[loop] Error:', err);
    await audit('loop_error', { loopCount, error: String(err) });
  }
}

async function shutdown(signal: string): Promise<void> {
  if (!running) return;
  running = false;

  console.log(`\n[shutdown] Received ${signal}, terminating agents...`);
  await audit('bridge_stopping', { signal, loopCount });

  await terminateAll();

  await audit('bridge_stopped', { signal, loopCount });
  console.log('[shutdown] Clean exit.');
  process.exit(0);
}

// Graceful shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Main
(async () => {
  try {
    await init();

    const config = await loadConfig();
    const interval = config.loop_interval_ms;

    console.log(`[bridge] Running main loop every ${interval}ms. Press Ctrl+C to stop.\n`);

    while (running) {
      await loop();
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
