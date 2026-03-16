import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ModelConfig, ModelProvider } from '../types';

interface ModelConfigState {
  configs: ModelConfig[];
  loading: boolean;
  error: string | null;
  fetchConfigs: () => Promise<void>;
  addConfig: (config: Omit<ModelConfig, 'id' | 'userId'>) => Promise<void>;
  updateConfig: (id: string, patch: Partial<Omit<ModelConfig, 'id' | 'userId'>>) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
}

export const useModelConfigStore = create<ModelConfigState>((set, get) => ({
  configs: [],
  loading: false,
  error: null,

  fetchConfigs: async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('model_configs')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      set({ configs: (data ?? []) as ModelConfig[] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  addConfig: async (config) => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ error: null });
    try {
      const { data, error } = await supabase
        .from('model_configs')
        .insert([config])
        .select()
        .single();
      if (error) throw error;
      set((s) => ({ configs: [...s.configs, data as ModelConfig] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  updateConfig: async (id, patch) => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ error: null });
    // Optimistic update
    const prev = get().configs;
    set((s) => ({
      configs: s.configs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    try {
      const { error } = await supabase
        .from('model_configs')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      // Revert on failure
      set({ configs: prev, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  deleteConfig: async (id) => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ error: null });
    const prev = get().configs;
    set((s) => ({ configs: s.configs.filter((c) => c.id !== id) }));
    try {
      const { error } = await supabase.from('model_configs').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      set({ configs: prev, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  setDefault: async (id) => {
    if (!isSupabaseConfigured() || !supabase) return;
    set({ error: null });
    const prev = get().configs;
    // Optimistically mark new default, clear old
    set((s) => ({
      configs: s.configs.map((c) => ({ ...c, isDefault: c.id === id })),
    }));
    try {
      // Clear existing default, then set new one
      const { error: clearErr } = await supabase
        .from('model_configs')
        .update({ is_default: false })
        .neq('id', id);
      if (clearErr) throw clearErr;
      const { error: setErr } = await supabase
        .from('model_configs')
        .update({ is_default: true })
        .eq('id', id);
      if (setErr) throw setErr;
    } catch (err) {
      set({ configs: prev, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },
}));

export type { ModelProvider };
