import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerReviewLoop, resetReviewCount, getReviewCount } from './review.js';

// Mock dependencies
vi.mock('../config.js', () => ({
  loadConfig: vi.fn(),
}));
vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./spawn.js', () => ({
  agentProcesses: new Map(),
  spawnAgent: vi.fn().mockResolvedValue(undefined),
}));

import { loadConfig } from '../config.js';
import { spawnAgent } from './spawn.js';

const mockConfig = {
  review_loop: {
    max_retries: 2,
    retry_prompt_suffix: 'Please fix issues.',
    auto_review_on_failure: false,
  },
};

describe('triggerReviewLoop', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockResolvedValue(mockConfig as never);
    vi.mocked(spawnAgent).mockResolvedValue(undefined);
    // Reset retry counts between tests
    resetReviewCount('s1', 'agent1');
  });

  it('spawns on first review attempt', async () => {
    const result = await triggerReviewLoop({
      session_id: 's1',
      agent_key: 'agent1',
      role: 'backend',
      prompt: 'Do the task',
    });

    expect(result).toBe(true);
    expect(getReviewCount('s1', 'agent1')).toBe(1);
    expect(spawnAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Please fix issues.'),
      }),
    );
  });

  it('appends retry_prompt_suffix to existing prompt', async () => {
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend', prompt: 'Initial task' });
    expect(spawnAgent).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Initial task\n\nPlease fix issues.' }),
    );
  });

  it('uses suffix alone when no prompt provided', async () => {
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    expect(spawnAgent).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Please fix issues.' }),
    );
  });

  it('allows up to max_retries attempts', async () => {
    const r1 = await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    const r2 = await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(getReviewCount('s1', 'agent1')).toBe(2);
  });

  it('returns false and does not spawn when limit is reached', async () => {
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    vi.mocked(spawnAgent).mockClear();

    const r3 = await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    expect(r3).toBe(false);
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('resets counter after exhaustion', async () => {
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' }); // exhausted
    expect(getReviewCount('s1', 'agent1')).toBe(0);
  });

  it('tracks counts independently per agent', async () => {
    resetReviewCount('s1', 'agent2');
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent1', role: 'backend' });
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent2', role: 'frontend' });
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agent2', role: 'frontend' });
    expect(getReviewCount('s1', 'agent1')).toBe(1);
    expect(getReviewCount('s1', 'agent2')).toBe(2);
    resetReviewCount('s1', 'agent2');
  });
});

describe('resetReviewCount', () => {
  it('resets the counter to zero', async () => {
    vi.mocked(loadConfig).mockResolvedValue(mockConfig as never);
    await triggerReviewLoop({ session_id: 's1', agent_key: 'agentX', role: 'backend' });
    expect(getReviewCount('s1', 'agentX')).toBe(1);
    resetReviewCount('s1', 'agentX');
    expect(getReviewCount('s1', 'agentX')).toBe(0);
  });
});
