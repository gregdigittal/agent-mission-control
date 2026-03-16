import { execa } from 'execa';
import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';

// Only allow safe branch name characters
const SAFE_BRANCH_PATTERN = /^[a-zA-Z0-9_\-\/\.]+$/;

function validateBranchName(name: string): void {
  if (!SAFE_BRANCH_PATTERN.test(name)) {
    throw new Error(`Invalid branch name "${name}": must contain only alphanumeric, slash, hyphen, underscore, or period characters`);
  }
  if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) {
    throw new Error(`Invalid branch name "${name}": must not start/end with a dot or contain ".."` );
  }
}

export interface CreateBranchPayload {
  branch_name: string;
  from_ref?: string; // defaults to HEAD
}

export interface SwitchBranchPayload {
  branch_name: string;
}

export interface MergeBranchPayload {
  source_branch: string;
  target_branch?: string; // defaults to current branch
  strategy?: 'merge' | 'squash' | 'rebase';
  message?: string;
}

export async function createBranch(payload: CreateBranchPayload): Promise<void> {
  validateBranchName(payload.branch_name);
  const config = await loadConfig();
  const fromRef = payload.from_ref ?? 'HEAD';

  await execa('git', ['checkout', '-b', payload.branch_name, fromRef], {
    cwd: config.repo_path,
  });

  await audit('branch_created', {
    branch: payload.branch_name,
    from: fromRef,
  });

  console.log(`[branch] Created branch ${payload.branch_name} from ${fromRef}`);
}

export async function switchBranch(payload: SwitchBranchPayload): Promise<void> {
  validateBranchName(payload.branch_name);
  const config = await loadConfig();

  await execa('git', ['checkout', payload.branch_name], {
    cwd: config.repo_path,
  });

  await audit('branch_switched', { branch: payload.branch_name });
  console.log(`[branch] Switched to branch ${payload.branch_name}`);
}

export async function mergeBranch(payload: MergeBranchPayload): Promise<void> {
  validateBranchName(payload.source_branch);
  const config = await loadConfig();

  // Switch to target branch first if specified
  if (payload.target_branch) {
    validateBranchName(payload.target_branch);
    await execa('git', ['checkout', payload.target_branch], { cwd: config.repo_path });
  }

  const strategy = payload.strategy ?? 'merge';
  const args: string[] = [];

  switch (strategy) {
    case 'squash':
      args.push('merge', '--squash', payload.source_branch);
      break;
    case 'rebase':
      args.push('rebase', payload.source_branch);
      break;
    default:
      args.push('merge', payload.source_branch);
      if (payload.message) args.push('-m', payload.message);
  }

  await execa('git', args, { cwd: config.repo_path });

  await audit('branch_merged', {
    source: payload.source_branch,
    target: payload.target_branch ?? 'current',
    strategy,
  });

  console.log(`[branch] Merged ${payload.source_branch} via ${strategy}`);
}

/** Returns all local branch names in the repo. */
export async function listBranches(): Promise<{ name: string; current: boolean }[]> {
  const config = await loadConfig();
  const { stdout } = await execa('git', ['branch', '--format=%(refname:short) %(HEAD)'], {
    cwd: config.repo_path,
  });

  return stdout.split('\n').filter(Boolean).map((line) => {
    const parts = line.trim().split(' ');
    const current = parts[1] === '*';
    return { name: parts[0], current };
  });
}
