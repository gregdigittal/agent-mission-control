/**
 * Role template loader.
 *
 * Templates are JSON files in bridge/src/role-templates/ that define
 * pre-built agent configurations for common roles. When a spawn command
 * includes a role_template field, the template is loaded and its
 * allowedTools and directoryScope are merged into the spawn config,
 * overriding the defaults from config.json's agent_roles section.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = __dirname;

export interface RoleTemplate {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly allowedTools: readonly string[];
  readonly directoryScope: readonly string[];
  readonly systemPrompt: string;
  readonly maxTurns: number;
}

function isValidTemplate(value: unknown): value is RoleTemplate {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t['name'] === 'string' &&
    typeof t['version'] === 'string' &&
    typeof t['description'] === 'string' &&
    Array.isArray(t['allowedTools']) &&
    (t['allowedTools'] as unknown[]).every(x => typeof x === 'string') &&
    Array.isArray(t['directoryScope']) &&
    (t['directoryScope'] as unknown[]).every(x => typeof x === 'string') &&
    typeof t['systemPrompt'] === 'string' &&
    typeof t['maxTurns'] === 'number' &&
    t['maxTurns'] > 0
  );
}

/**
 * Load a role template by name.
 *
 * @param name - Template name (matches the JSON filename without extension)
 * @returns The parsed and validated template, or null if not found
 */
export async function loadRoleTemplate(name: string): Promise<RoleTemplate | null> {
  // Sanitise name to prevent path traversal
  const sanitised = name.replace(/[^a-z0-9-]/g, '');
  if (sanitised !== name || !name || name.length > 64) {
    return null;
  }

  const templatePath = join(TEMPLATES_DIR, `${sanitised}.json`);

  try {
    const raw = await readFile(templatePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isValidTemplate(parsed)) {
      console.error(`[role-templates] Invalid template schema for '${name}'`);
      return null;
    }
    return parsed;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null; // Template simply doesn't exist
    }
    console.error(`[role-templates] Failed to load template '${name}':`, err);
    return null;
  }
}

/**
 * List all available template names (without .json extension).
 */
export async function listRoleTemplates(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  try {
    const entries = await readdir(TEMPLATES_DIR);
    return entries
      .filter(e => e.endsWith('.json'))
      .map(e => e.slice(0, -5))
      .sort();
  } catch {
    return [];
  }
}
