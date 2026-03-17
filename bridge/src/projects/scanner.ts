/**
 * scanner.ts — Project discovery scanner.
 *
 * Scans immediate subdirectories of `config.projects_root` for git repos (.git/),
 * detects the tech stack, and upserts each discovered project into Supabase
 * using `local_path` as the idempotency key.
 *
 * Rules:
 * - Depth is exactly 1 level (immediate children of projects_root only).
 * - Non-git directories are silently skipped.
 * - Uses the service role client so writes bypass RLS.
 * - If projects_root is absent or not a directory, logs a warning and returns [].
 */

import { readdir, stat, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { constants } from 'node:fs';
import { loadConfig } from '../config.js';
import { getSupabaseAdminClient } from '../supabase/client.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ScannedProject {
  readonly name: string;
  readonly local_path: string;
  readonly backlog_path: string | null;
  readonly detected_stack: string[];
  readonly last_scanned_at: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stack detection
// ──────────────────────────────────────────────────────────────────────────────

type StackFile = { file: string; stacks: string[] };

const STACK_FILES: StackFile[] = [
  { file: 'package.json',      stacks: ['node', 'typescript'] },
  { file: 'pyproject.toml',    stacks: ['python'] },
  { file: 'requirements.txt',  stacks: ['python'] },
  { file: 'go.mod',            stacks: ['go'] },
  { file: 'Cargo.toml',        stacks: ['rust'] },
  { file: 'composer.json',     stacks: ['php'] },
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function detectStack(projectPath: string): Promise<string[]> {
  const found = new Set<string>();
  for (const { file, stacks } of STACK_FILES) {
    if (await fileExists(join(projectPath, file))) {
      stacks.forEach((s) => found.add(s));
    }
  }
  return Array.from(found);
}

// ──────────────────────────────────────────────────────────────────────────────
// Scanner
// ──────────────────────────────────────────────────────────────────────────────

export async function scanProjects(): Promise<ScannedProject[]> {
  const config = await loadConfig();

  if (!config.projects_root) {
    return [];
  }

  const root = config.projects_root;

  // Verify the root exists and is a directory
  try {
    const s = await stat(root);
    if (!s.isDirectory()) {
      console.warn(`[projects] projects_root '${root}' is not a directory — skipping scan`);
      return [];
    }
  } catch {
    console.warn(`[projects] projects_root '${root}' does not exist — skipping scan`);
    return [];
  }

  // Read immediate children
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (err) {
    console.warn(`[projects] Cannot read projects_root '${root}':`, err);
    return [];
  }

  const discovered: ScannedProject[] = [];
  const now = new Date().toISOString();

  for (const entry of entries) {
    const projectPath = join(root, entry);

    try {
      const s = await stat(projectPath);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    // Must have .git/
    if (!(await fileExists(join(projectPath, '.git')))) continue;

    const [detectedStack, hasBacklog] = await Promise.all([
      detectStack(projectPath),
      fileExists(join(projectPath, 'BACKLOG.md')),
    ]);

    discovered.push({
      name: basename(projectPath),
      local_path: projectPath,
      backlog_path: hasBacklog ? join(projectPath, 'BACKLOG.md') : null,
      detected_stack: detectedStack,
      last_scanned_at: now,
    });
  }

  // Upsert all discovered projects into Supabase
  const adminClient = await getSupabaseAdminClient();
  if (adminClient && discovered.length > 0) {
    const rows = discovered.map((p) => ({
      name: p.name,
      local_path: p.local_path,
      backlog_path: p.backlog_path,
      detected_stack: p.detected_stack,
      last_scanned_at: p.last_scanned_at,
    }));

    const { error } = await adminClient
      .from('projects')
      .upsert(rows, { onConflict: 'local_path', ignoreDuplicates: false });

    if (error) {
      console.warn(`[projects] Supabase upsert error:`, error.message);
    } else {
      console.log(`[projects] Scanned ${discovered.length} project(s) — upserted to Supabase`);
    }
  } else if (!adminClient) {
    console.log(`[projects] SUPABASE_SERVICE_ROLE_KEY not set — scan results not persisted`);
  }

  return discovered;
}
