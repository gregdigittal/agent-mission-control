import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const NODE_ID_FILE = join(homedir(), '.agent-mc', 'node-id');

let cachedNodeId: string | null = null;

/**
 * Returns a stable UUID for this VPS node.
 * Reads from ~/.agent-mc/node-id; generates and saves one if absent.
 * The human-readable VPS_NODE_ID env var is stored separately as the node name.
 */
export async function getNodeUuid(): Promise<string> {
  if (cachedNodeId) return cachedNodeId;

  try {
    const id = (await readFile(NODE_ID_FILE, 'utf8')).trim();
    if (id) {
      cachedNodeId = id;
      return id;
    }
  } catch {
    // File absent — generate a new one
  }

  const id = randomUUID();
  try {
    await writeFile(NODE_ID_FILE, id, 'utf8');
  } catch (err) {
    console.warn('[vps] Could not persist node UUID:', err);
  }
  cachedNodeId = id;
  return id;
}
