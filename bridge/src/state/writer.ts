import { writeFile, rename } from 'node:fs/promises';
import { DASHBOARD_STATE_PATH, HEARTBEAT_PATH, AGENTS_STATE_DIR } from '../config.js';
import { join } from 'node:path';
import type { DashboardState } from './aggregator.js';

/** Write to .tmp then atomically rename — prevents partial reads by the dashboard. */
async function atomicWrite(path: string, data: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, data);
  await rename(tmpPath, path);
}

export async function writeDashboardState(state: DashboardState): Promise<void> {
  await atomicWrite(DASHBOARD_STATE_PATH, JSON.stringify(state, null, 2));
}

export async function writeHeartbeat(): Promise<void> {
  const heartbeat = {
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  await atomicWrite(HEARTBEAT_PATH, JSON.stringify(heartbeat, null, 2));
}

export async function writeAgentState(agentKey: string, state: Record<string, unknown>): Promise<void> {
  const path = join(AGENTS_STATE_DIR, `${agentKey}.json`);
  await atomicWrite(path, JSON.stringify(state, null, 2));
}
