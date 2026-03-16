import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config so tests don't require a real config.json on disk.
vi.mock('../config.js', () => ({
  loadConfig: vi.fn(),
}));

import { loadConfig } from '../config.js';
import type { AgentProcess } from '../health/checker.js';
import type { KanbanTask } from './assigner.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(roles: Record<string, { tool_allowlist: string[]; directory_scope: string[] }>) {
  return {
    loop_interval_ms: 2000,
    repo_path: '/tmp/repo',
    max_agents: 5,
    auto_restart_on_crash: true,
    worktreeSync: { mode: 'none' as const },
    worktree_bootstrap: { copy_files: [], run_commands: [] },
    supabase: { url: '', anon_key: '', enabled: false },
    agent_defaults: { model: 'claude-sonnet-4-6', max_turns: 50, tool_allowlist: [] },
    agent_roles: roles,
    budget: { session_limit_cents: null, agent_limit_cents: null, alert_threshold_pct: 80 },
    webhooks: [],
    review_loop: { max_retries: 3, retry_prompt_suffix: '', auto_review_on_failure: false },
  };
}

function makeAgent(
  agentKey: string,
  role: string,
  running = true,
  overrides: Partial<AgentProcess> = {},
): AgentProcess {
  return {
    sessionId: 'sess-1',
    agentKey,
    role,
    pid: Math.floor(Math.random() * 9000) + 1000,
    worktreePath: `/tmp/worktrees/${agentKey}`,
    running,
    startedAt: new Date(),
    lastOutputAt: new Date(),
    restartCount: 0,
    ...overrides,
  };
}

function makeTask(id: string, tags: string[] = [], assignedAgentKey?: string): KanbanTask {
  return { id, title: `Task ${id}`, tags, assignedAgentKey };
}

const DEFAULT_ROLES = {
  lead: { tool_allowlist: ['Read', 'Write'], directory_scope: ['/'] },
  backend: { tool_allowlist: ['Read', 'Write'], directory_scope: ['/app', '/routes', '/tests'] },
  frontend: { tool_allowlist: ['Read', 'Write'], directory_scope: ['/src', '/components'] },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assignTask()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockResolvedValue(makeConfig(DEFAULT_ROLES) as ReturnType<typeof makeConfig>);
  });

  it('returns null when no agents are provided', async () => {
    const { assignTask } = await import('./assigner.js');
    const result = await assignTask(makeTask('t1'), []);
    expect(result).toBeNull();
  });

  it('returns null when all agents are not running', async () => {
    const { assignTask } = await import('./assigner.js');
    const agents = [
      makeAgent('backend-a', 'backend', false),
      makeAgent('backend-b', 'backend', false),
    ];
    const result = await assignTask(makeTask('t1', ['app']), agents);
    expect(result).toBeNull();
  });

  it('skips non-running agents and picks the running one', async () => {
    const { assignTask } = await import('./assigner.js');
    const agents = [
      makeAgent('backend-stopped', 'backend', false),
      makeAgent('backend-running', 'backend', true),
    ];
    const result = await assignTask(makeTask('t1', ['app']), agents);
    expect(result?.agentKey).toBe('backend-running');
  });

  it('prefers the agent with fewer active tasks (lower load)', async () => {
    const { assignTask } = await import('./assigner.js');
    const agentBusy = makeAgent('backend-busy', 'backend');
    const agentFree = makeAgent('backend-free', 'backend');

    // agentBusy already has 2 tasks assigned; agentFree has 0
    const existingTasks: KanbanTask[] = [
      makeTask('existing-1', [], 'backend-busy'),
      makeTask('existing-2', [], 'backend-busy'),
    ];

    const result = await assignTask(
      makeTask('new-task', ['app']),
      [agentBusy, agentFree],
      existingTasks,
    );

    expect(result?.agentKey).toBe('backend-free');
  });

  it('does not assign a frontend task to a backend agent', async () => {
    const { assignTask } = await import('./assigner.js');
    // Only a backend agent is available; task has frontend tags
    const agents = [makeAgent('backend-a', 'backend')];
    const result = await assignTask(makeTask('t1', ['src', 'components']), agents);
    expect(result).toBeNull();
  });

  it('assigns a frontend task to a frontend agent and not a backend agent', async () => {
    const { assignTask } = await import('./assigner.js');
    const agents = [
      makeAgent('backend-a', 'backend'),
      makeAgent('frontend-a', 'frontend'),
    ];
    const result = await assignTask(makeTask('t1', ['src']), agents);
    expect(result?.agentKey).toBe('frontend-a');
  });

  it('assigns any task to a lead agent (lead covers all directory scopes)', async () => {
    const { assignTask } = await import('./assigner.js');
    const agents = [makeAgent('lead-a', 'lead')];
    const result = await assignTask(makeTask('t1', ['completely-unknown-scope']), agents);
    expect(result?.agentKey).toBe('lead-a');
  });

  it('returns null when no running agent has a matching role for the task tags', async () => {
    const { assignTask } = await import('./assigner.js');
    const agents = [makeAgent('frontend-a', 'frontend')];
    // Task tags only match backend scopes
    const result = await assignTask(makeTask('t1', ['routes', 'database']), agents);
    expect(result).toBeNull();
  });

  it('handles tasks with no tags — only lead agents match', async () => {
    const { assignTask } = await import('./assigner.js');
    const agents = [
      makeAgent('backend-a', 'backend'),
      makeAgent('lead-a', 'lead'),
    ];
    // No tags: backend scope won't match; lead will
    const result = await assignTask(makeTask('t1', []), agents);
    expect(result?.agentKey).toBe('lead-a');
  });
});
