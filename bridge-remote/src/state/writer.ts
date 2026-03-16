/**
 * State writer — atomic file writes (.tmp then rename).
 * Mirrors bridge/src/state/writer.ts pattern.
 * Prevents the primary bridge (reading via rsync) from seeing partial JSON.
 */

import { writeFile, rename } from 'node:fs/promises';
import { AGENT_STATE_PATH, HEARTBEAT_PATH } from '../config.js';

async function atomicWrite(path: string, data: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, data);
  await rename(tmpPath, path);
}

export interface RemoteAgentState {
  nodeId: string;
  agents: RemoteAgentInfo[];
  timestamp: string;
}

export interface RemoteAgentInfo {
  agentKey: string;
  status: string;
  contextUsagePct: number;
  costCents: number;
  pid: number;
  uptimeMs: number;
}

export async function writeAgentState(state: RemoteAgentState): Promise<void> {
  await atomicWrite(AGENT_STATE_PATH, JSON.stringify(state, null, 2));
}

export async function writeHeartbeat(nodeId: string): Promise<void> {
  const heartbeat = {
    nodeId,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
  };
  await atomicWrite(HEARTBEAT_PATH, JSON.stringify(heartbeat, null, 2));
}
