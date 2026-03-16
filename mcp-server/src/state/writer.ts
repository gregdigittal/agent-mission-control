import { writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Atomic JSON write: write to .tmp then rename to final path.
 * Creates parent directories as needed.
 */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tmp, path);
}

/**
 * Append a single JSON line to a JSONL file (audit log).
 * Creates parent directories as needed.
 */
export async function appendJsonLine(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify(data) + '\n';
  const { appendFile } = await import('node:fs/promises');
  await appendFile(path, line, 'utf-8');
}
