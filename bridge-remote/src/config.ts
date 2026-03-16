import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

export const BASE_DIR = join(homedir(), '.agent-mc-remote');
export const STATE_DIR = join(BASE_DIR, 'state');
export const LOGS_DIR = join(BASE_DIR, 'logs');
export const CONFIG_PATH = join(BASE_DIR, 'config.json');
export const HEARTBEAT_PATH = join(STATE_DIR, 'heartbeat.json');
export const AGENT_STATE_PATH = join(STATE_DIR, 'agent_state.json');

const RemoteBridgeConfigSchema = z.object({
  /** Identifier for this VPS node (matches vpsRegistry entry) */
  node_id: z.string(),
  node_label: z.string(),
  /** Path to sync state back to primary bridge (rsync destination) */
  primary_bridge_rsync_target: z.string().optional(),
  /** Poll interval in ms */
  loop_interval_ms: z.number().default(5000),
  /** Agents this bridge-remote is allowed to monitor */
  monitored_agents: z.array(z.string()).default([]),
});

export type RemoteBridgeConfig = z.infer<typeof RemoteBridgeConfigSchema>;

let cachedConfig: RemoteBridgeConfig | null = null;

export async function ensureDirectories(): Promise<void> {
  for (const dir of [BASE_DIR, STATE_DIR, LOGS_DIR]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

export async function loadConfig(): Promise<RemoteBridgeConfig> {
  if (cachedConfig) return cachedConfig;
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found at ${CONFIG_PATH}. Run: agent-bridge-remote --init`);
  }
  const raw = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  cachedConfig = RemoteBridgeConfigSchema.parse(raw);
  return cachedConfig;
}

export async function writeDefaultConfig(nodeId: string, nodeLabel: string): Promise<void> {
  const config: RemoteBridgeConfig = {
    node_id: nodeId,
    node_label: nodeLabel,
    loop_interval_ms: 5000,
    monitored_agents: [],
  };
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}
