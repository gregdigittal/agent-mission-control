import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from './agentStore';
import type { Agent, AgentEvent } from '../types';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    sessionId: 'sess-1',
    name: 'Test Agent',
    role: 'backend',
    status: 'running',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    buildProgress: 0,
    contextUsed: 10000,
    contextLimit: 200000,
    costUsd: 0.05,
    tokensIn: 500,
    tokensOut: 300,
    lastSeen: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: 'evt-1',
    agentId: 'agent-1',
    sessionId: 'sess-1',
    type: 'tool_call',
    message: 'Read file',
    ts: new Date().toISOString(),
    ...overrides,
  };
}

describe('agentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({ agents: {}, events: [], eventFilter: null });
  });

  it('setAgents — stores agents keyed by id', () => {
    const agent = makeAgent();
    useAgentStore.getState().setAgents([agent]);
    expect(useAgentStore.getState().agents['agent-1']).toEqual(agent);
  });

  it('updateAgent — merges partial update without clobbering other fields', () => {
    const agent = makeAgent();
    useAgentStore.getState().setAgents([agent]);
    useAgentStore.getState().updateAgent('agent-1', { status: 'idle' });
    const updated = useAgentStore.getState().agents['agent-1'];
    expect(updated.status).toBe('idle');
    expect(updated.name).toBe('Test Agent');
  });

  it('prependEvent — newest event is first', () => {
    const ev1 = makeEvent({ id: 'evt-1', message: 'first' });
    const ev2 = makeEvent({ id: 'evt-2', message: 'second' });
    useAgentStore.getState().prependEvent(ev1);
    useAgentStore.getState().prependEvent(ev2);
    expect(useAgentStore.getState().events[0].id).toBe('evt-2');
  });

  it('prependEvent — caps at 500 events', () => {
    for (let i = 0; i < 510; i++) {
      useAgentStore.getState().prependEvent(makeEvent({ id: `evt-${i}` }));
    }
    expect(useAgentStore.getState().events.length).toBe(500);
  });

  it('agentsBySession — returns only agents for the specified session', () => {
    const a1 = makeAgent({ id: 'a1', sessionId: 'sess-1' });
    const a2 = makeAgent({ id: 'a2', sessionId: 'sess-2' });
    useAgentStore.getState().setAgents([a1, a2]);
    const result = useAgentStore.getState().agentsBySession('sess-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('eventsBySession — filters by session', () => {
    const ev1 = makeEvent({ id: 'e1', sessionId: 'sess-1' });
    const ev2 = makeEvent({ id: 'e2', sessionId: 'sess-2' });
    useAgentStore.getState().setEvents([ev1, ev2]);
    const result = useAgentStore.getState().eventsBySession('sess-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('eventsBySession — respects eventFilter (agent filter)', () => {
    const ev1 = makeEvent({ id: 'e1', sessionId: 'sess-1', agentId: 'agent-1' });
    const ev2 = makeEvent({ id: 'e2', sessionId: 'sess-1', agentId: 'agent-2' });
    useAgentStore.getState().setEvents([ev1, ev2]);
    useAgentStore.getState().setEventFilter('agent-1');
    const result = useAgentStore.getState().eventsBySession('sess-1');
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('agent-1');
  });
});
