import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LOGS_DIR } from '../config.js';

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
    // Last resort — log to stderr but don't crash the bridge
    console.error('[audit] Failed to write audit log:', err);
  }
}
