/**
 * VPS Registry — file-backed store of registered VPS instances.
 *
 * Uses atomic write pattern (.tmp then rename) consistent with bridge/src/state/writer.ts.
 * The registry file lives in the bridge state dir: ~/.agent-mc/state/vps-registry.json
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { STATE_DIR } from '../config.js';
import { audit } from '../audit/logger.js';
import { getHeartbeatResults } from './heartbeatMonitor.js';
import type { VpsConfig, VpsRegistry } from './types.js';

export type LbStrategy = 'least-loaded' | 'round-robin';

// Round-robin counter (per-strategy, in-memory only — resets on bridge restart)
let roundRobinIndex = 0;

const REGISTRY_PATH = join(STATE_DIR, 'vps-registry.json');

async function readRegistry(): Promise<VpsRegistry> {
  if (!existsSync(REGISTRY_PATH)) {
    return { vps: [], updatedAt: new Date().toISOString() };
  }
  try {
    const raw = JSON.parse(await readFile(REGISTRY_PATH, 'utf-8'));
    return raw as VpsRegistry;
  } catch {
    return { vps: [], updatedAt: new Date().toISOString() };
  }
}

async function writeRegistry(registry: VpsRegistry): Promise<void> {
  const tmpPath = `${REGISTRY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await rename(tmpPath, REGISTRY_PATH);
}

export async function listVps(): Promise<VpsConfig[]> {
  const registry = await readRegistry();
  return registry.vps;
}

export async function registerVps(
  config: Omit<VpsConfig, 'id' | 'registeredAt'>,
): Promise<VpsConfig> {
  const registry = await readRegistry();
  const entry: VpsConfig = {
    ...config,
    id: randomBytes(8).toString('hex'),
    registeredAt: new Date().toISOString(),
  };
  registry.vps.push(entry);
  registry.updatedAt = new Date().toISOString();
  await writeRegistry(registry);
  await audit('vps_registered', { vpsId: entry.id, host: entry.host, label: entry.label });
  console.log(`[vps] Registered ${entry.label} (${entry.host})`);
  return entry;
}

export async function unregisterVps(id: string): Promise<boolean> {
  const registry = await readRegistry();
  const before = registry.vps.length;
  registry.vps = registry.vps.filter((v) => v.id !== id);
  if (registry.vps.length === before) return false;
  registry.updatedAt = new Date().toISOString();
  await writeRegistry(registry);
  await audit('vps_unregistered', { vpsId: id });
  return true;
}

export async function getVps(id: string): Promise<VpsConfig | undefined> {
  const registry = await readRegistry();
  return registry.vps.find((v) => v.id === id);
}

export async function updateVps(id: string, patch: Partial<Omit<VpsConfig, 'id' | 'registeredAt'>>): Promise<boolean> {
  const registry = await readRegistry();
  const idx = registry.vps.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  registry.vps[idx] = { ...registry.vps[idx], ...patch };
  registry.updatedAt = new Date().toISOString();
  await writeRegistry(registry);
  return true;
}

/**
 * Select the best VPS node for a new agent spawn.
 *
 * Filters out nodes with no heartbeat or unhealthy status, then applies
 * the chosen strategy:
 * - 'least-loaded': picks the node with lowest agentCount / agentCapacity ratio
 * - 'round-robin': rotates through healthy nodes in registration order
 *
 * Returns undefined when no healthy nodes are registered (caller falls back to local spawn).
 */
export async function selectVps(strategy: LbStrategy = 'least-loaded'): Promise<VpsConfig | undefined> {
  const allNodes = await listVps();
  if (allNodes.length === 0) return undefined;

  // Filter to nodes confirmed healthy by the heartbeat monitor
  const heartbeats = getHeartbeatResults();
  const healthyIds = new Set(heartbeats.filter((h) => h.status === 'ok').map((h) => h.vpsId));
  const candidates = allNodes.filter((v) => healthyIds.has(v.id));

  if (candidates.length === 0) return undefined;

  if (strategy === 'round-robin') {
    const node = candidates[roundRobinIndex % candidates.length];
    roundRobinIndex = (roundRobinIndex + 1) % candidates.length;
    return node;
  }

  // least-loaded: lowest ratio of agentCount / agentCapacity
  // Nodes without capacity set are treated as unconstrained (ratio = 0)
  return candidates.reduce((best, node) => {
    const bestRatio = (best.agentCount ?? 0) / Math.max(best.agentCapacity ?? 1, 1);
    const nodeRatio = (node.agentCount ?? 0) / Math.max(node.agentCapacity ?? 1, 1);
    return nodeRatio < bestRatio ? node : best;
  });
}
