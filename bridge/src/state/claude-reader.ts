import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Claude Code stores project-level state in ~/.claude/projects/
const CLAUDE_DIR = join(homedir(), '.claude');

export interface ClaudeSessionData {
  contextUsagePct: number;
  costCents: number;
  messageCount: number;
  currentTask: string;
  activeFiles: string[];
  status: string;
}

export async function readClaudeState(worktreePath: string): Promise<ClaudeSessionData | null> {
  try {
    // Claude Code stores per-project data keyed by project directory
    // The exact path format is ~/.claude/projects/<encoded-path>/
    const encodedPath = worktreePath.replace(/\//g, '-');
    const projectDir = join(CLAUDE_DIR, 'projects', encodedPath);

    if (!existsSync(projectDir)) return null;

    // Try to read session state files
    const files = await readdir(projectDir).catch(() => [] as string[]);
    const stateFile = files.find(f => f.endsWith('.json'));
    if (!stateFile) return null;

    const raw = JSON.parse(await readFile(join(projectDir, stateFile), 'utf-8'));

    return {
      contextUsagePct: raw.context_usage_pct ?? 0,
      costCents: raw.cost_cents ?? 0,
      messageCount: raw.message_count ?? 0,
      currentTask: raw.current_task ?? '',
      activeFiles: raw.active_files ?? [],
      status: raw.status ?? 'idle',
    };
  } catch {
    return null;
  }
}

export async function readClaudeProjects(): Promise<string[]> {
  const projectsDir = join(CLAUDE_DIR, 'projects');
  if (!existsSync(projectsDir)) return [];
  try {
    return await readdir(projectsDir);
  } catch {
    return [];
  }
}
