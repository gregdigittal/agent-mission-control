/**
 * Audit logger — append-only JSONL log.
 * Mirrors bridge/src/audit/logger.ts exactly.
 * NEVER uses writeFile or truncating operations on audit files.
 */

import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LOGS_DIR } from '../config.js';

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(LOGS_DIR, `audit_${date}.jsonl`);
}

export async function audit(
  event: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  const line = JSON.stringify(entry) + '\n';
  try {
    await appendFile(getLogFilePath(), line);
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}
