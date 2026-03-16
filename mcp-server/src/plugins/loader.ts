import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AgentPlugin } from './types.js';

/**
 * Validates that a value conforms to the AgentPlugin shape.
 * Checks for name (string), version (string), and tools (non-empty array).
 */
function isAgentPlugin(value: unknown): value is AgentPlugin {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['name'] !== 'string' || obj['name'].trim() === '') return false;
  if (typeof obj['version'] !== 'string' || obj['version'].trim() === '') return false;
  if (typeof obj['description'] !== 'string') return false;
  if (!Array.isArray(obj['tools'])) return false;
  return true;
}

/**
 * Loads all *.plugin.js files from pluginDir via dynamic import.
 * Invalid or crashing plugins are skipped with a warning — never throws.
 */
export async function loadPlugins(pluginDir: string): Promise<AgentPlugin[]> {
  const absDir = resolve(pluginDir);
  let entries: string[];

  try {
    entries = await readdir(absDir);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[plugins] Could not read plugin directory ${absDir}: ${message}\n`);
    return [];
  }

  const pluginFiles = entries.filter((f) => f.endsWith('.plugin.js'));
  const plugins: AgentPlugin[] = [];

  for (const file of pluginFiles) {
    const filePath = join(absDir, file);
    try {
      // Dynamic import — each plugin is an ES module with a default export
      const mod = await import(filePath) as { default?: unknown };
      const exported = mod.default;

      if (!isAgentPlugin(exported)) {
        process.stderr.write(
          `[plugins] Skipping ${file}: export does not match AgentPlugin shape ` +
          `(requires name, version, description, tools[])\n`,
        );
        continue;
      }

      plugins.push(exported);
      process.stderr.write(`[plugins] Loaded plugin: ${exported.name}@${exported.version}\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[plugins] Skipping ${file}: import failed — ${message}\n`);
    }
  }

  return plugins;
}
