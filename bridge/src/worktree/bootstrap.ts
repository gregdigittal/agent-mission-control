import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execaCommand } from 'execa';
import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';

export async function bootstrapEnvironment(worktreePath: string): Promise<void> {
  const config = await loadConfig();
  const bootstrap = config.worktree_bootstrap;

  // Copy environment files
  for (const file of bootstrap.copy_files) {
    const src = join(config.repo_path, file);
    const dest = join(worktreePath, file);
    if (existsSync(src)) {
      await copyFile(src, dest);
    }
  }

  // Run bootstrap commands
  for (const cmd of bootstrap.run_commands) {
    try {
      await execaCommand(cmd, { cwd: worktreePath, timeout: 120_000 });
    } catch (err) {
      await audit('bootstrap_command_failed', { worktreePath, cmd, error: String(err) });
      // Non-fatal: agent can still run even if npm install fails
      console.warn(`[bootstrap] Command failed in ${worktreePath}: ${cmd}`);
    }
  }

  await audit('bootstrap_complete', { worktreePath });
}
