import { create } from 'zustand';
import type { Agent, AgentEvent } from '../types';

interface AgentState {
  agents: Record<string, Agent>;
  events: AgentEvent[];
  eventFilter: string | null; // agentId filter, null = all
  workspaceId: string | null;

  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, update: Partial<Agent>) => void;
  setEvents: (events: AgentEvent[]) => void;
  prependEvent: (event: AgentEvent) => void;
  setEventFilter: (agentId: string | null) => void;
  setWorkspaceId: (id: string | null) => void;

  agentsBySession: (sessionId: string) => Agent[];
  eventsBySession: (sessionId: string) => AgentEvent[];
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: {},
  events: [],
  eventFilter: null,
  workspaceId: null,

  setAgents: (agents) =>
    set({ agents: Object.fromEntries(agents.map((a) => [a.id, a])) }),

  updateAgent: (id, update) =>
    set((s) => ({
      agents: { ...s.agents, [id]: { ...s.agents[id], ...update } },
    })),

  setEvents: (events) => set({ events }),

  prependEvent: (event) =>
    set((s) => ({ events: [event, ...s.events].slice(0, 500) })),

  setEventFilter: (agentId) => set({ eventFilter: agentId }),

  setWorkspaceId: (id) => set({ workspaceId: id }),

  agentsBySession: (sessionId) =>
    Object.values(get().agents).filter((a) => a.sessionId === sessionId),

  eventsBySession: (sessionId) => {
    const { events, eventFilter } = get();
    return events
      .filter((e) => e.sessionId === sessionId)
      .filter((e) => !eventFilter || e.agentId === eventFilter);
  },
}));
