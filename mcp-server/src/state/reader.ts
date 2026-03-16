import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function readJsonDir<T>(dir: string): Promise<T[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw err;
  }

  const results: T[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const data = await readJsonFile<T | null>(join(dir, entry), null);
    if (data !== null) results.push(data);
  }
  return results;
}
