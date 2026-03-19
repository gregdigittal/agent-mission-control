import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { VpsNode, VpsHealth } from '../types';

interface VpsState {
  nodes: VpsNode[];
  loading: boolean;
  error: string | null;
  setNodes: (nodes: VpsNode[]) => void;
  updateNode: (id: string, update: Partial<VpsNode>) => void;
  fetchNodes: () => Promise<void>;
  addNode: (node: { name: string; hostname: string; region: string; maxAgents: number }) => Promise<void>;
  removeNode: (id: string) => Promise<void>;
  healthyNodes: () => VpsNode[];
}

export const useVpsStore = create<VpsState>((set, get) => ({
  nodes: [],
  loading: false,
  error: null,

  setNodes: (nodes) => set({ nodes }),

  updateNode: (id, update) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...update } : n)),
    })),

  fetchNodes: async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.from('vps_nodes').select('*').order('name');
      if (error) throw error;
      set({ nodes: (data ?? []) as VpsNode[] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  addNode: async ({ name, hostname, region, maxAgents }) => {
    if (!isSupabaseConfigured() || !supabase) {
      set({ error: 'Supabase is not configured — cannot register node' });
      return;
    }
    set({ error: null });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ error: 'Not authenticated' });
      return;
    }

    const newNode = {
      user_id: user.id,
      name,
      hostname,
      status: 'offline' as VpsHealth,
      current_agent_count: 0,
      max_concurrent_agents: maxAgents,
      last_heartbeat: null,
      agent_bridge_version: null,
      system_info: { region },
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('vps_nodes')
        .insert([newNode])
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ nodes: [...s.nodes, data as VpsNode] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  removeNode: async (id) => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ error: null });
    const prev = get().nodes;
    set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id) }));
    try {
      const { error } = await supabase.from('vps_nodes').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      set({ nodes: prev, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  healthyNodes: () => get().nodes.filter((n) => n.status === 'online'),
}));
