/**
 * create_pr command handler.
 *
 * Looks up the agent's worktree path from the in-memory agent registry
 * (agentProcesses), creates a sanitised pr/<title> branch, pushes it, then
 * runs `gh pr create` to open a pull request.
 *
 * Security: all git/gh calls use spawnSync with an args array — no shell
 * string interpolation so user-supplied title/body cannot inject commands.
 */

import { spawnSync } from 'node:child_process';
import { agentProcesses } from './spawn.js';
import { audit } from '../audit/logger.js';

export interface CreatePrPayload {
  sessionId: string;
  title: string;
  body: string;
  baseBranch: string;
}

export interface CreatePrResult {
  prUrl?: string;
  branch?: string;
  error?: string;
}

/** Sanitise a PR title into a valid git branch name segment. */
export function sanitiseBranchName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric runs with a hyphen
    .replace(/^-+|-+$/g, '')     // strip leading/trailing hyphens
    .slice(0, 50);               // max 50 chars
}

/**
 * Handle a create_pr command.
 *
 * Returns a result object rather than throwing so the command processor can
 * treat this as a non-fatal operation.
 */
export async function handleCreatePr(payload: CreatePrPayload): Promise<CreatePrResult> {
  const { sessionId, title, body, baseBranch } = payload;

  // --- Resolve worktree path from agent registry ---
  // Find any running agent in this session (the most recently registered one
  // takes precedence; in practice, one agent owns each session).
  let worktreePath: string | undefined;

  for (const [, agent] of agentProcesses) {
    if (agent.sessionId === sessionId) {
      worktreePath = agent.worktreePath;
      break;
    }
  }

  if (!worktreePath) {
    const error = `No agent found for sessionId "${sessionId}"`;
    console.error(`[createPr] ${error}`);
    await audit('create_pr_error', { sessionId, error });
    return { error };
  }

  const sanitised = sanitiseBranchName(title);
  if (!sanitised) {
    const error = `Title "${title}" produced an empty branch name after sanitisation`;
    console.error(`[createPr] ${error}`);
    await audit('create_pr_error', { sessionId, error });
    return { error };
  }

  const branch = `pr/${sanitised}`;

  // --- git checkout -b pr/<sanitised-title> ---
  const checkoutResult = spawnSync('git', ['checkout', '-b', branch], {
    cwd: worktreePath,
    encoding: 'utf-8',
  });

  if (checkoutResult.status !== 0) {
    const error = `git checkout -b failed: ${checkoutResult.stderr?.trim() ?? 'unknown error'}`;
    console.error(`[createPr] ${error}`);
    await audit('create_pr_error', { sessionId, branch, error });
    return { error };
  }

  // --- git push origin HEAD ---
  const pushResult = spawnSync('git', ['push', 'origin', 'HEAD'], {
    cwd: worktreePath,
    encoding: 'utf-8',
  });

  if (pushResult.status !== 0) {
    const error = `git push failed: ${pushResult.stderr?.trim() ?? 'unknown error'}`;
    console.error(`[createPr] ${error}`);
    await audit('create_pr_error', { sessionId, branch, error });
    return { error };
  }

  // --- gh pr create ---
  const ghResult = spawnSync(
    'gh',
    [
      'pr', 'create',
      '--title', title,
      '--body', body,
      '--base', baseBranch,
      '--head', branch,
    ],
    {
      cwd: worktreePath,
      encoding: 'utf-8',
    },
  );

  if (ghResult.status !== 0) {
    const error = `gh pr create failed: ${ghResult.stderr?.trim() ?? 'unknown error'}`;
    console.error(`[createPr] ${error}`);
    await audit('create_pr_error', { sessionId, branch, error });
    return { error };
  }

  // gh pr create prints the PR URL as the last line of stdout
  const prUrl = ghResult.stdout?.trim().split('\n').pop() ?? '';

  await audit('create_pr_success', { sessionId, branch, prUrl });
  console.log(`[createPr] PR created for session ${sessionId}: ${prUrl}`);

  return { prUrl, branch };
}
