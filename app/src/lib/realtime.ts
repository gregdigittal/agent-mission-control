import { supabase, isSupabaseConfigured } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type ChangeHandler = (payload: Record<string, unknown>) => void;

const activeChannels = new Map<string, RealtimeChannel>();

export function subscribeToTable(
  table: string,
  onchange: ChangeHandler,
  onError?: () => void,
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const key = `table:${table}`;
  const existing = activeChannels.get(key);
  if (existing) {
    supabase.removeChannel(existing);
  }

  const channel = supabase
    .channel(key)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => onchange(payload as Record<string, unknown>),
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIPTION_ERROR') {
        console.error(`[realtime] subscription error on ${table}`);
        onError?.();
      }
    });

  activeChannels.set(key, channel);

  return () => {
    supabase?.removeChannel(channel);
    activeChannels.delete(key);
  };
}

export function unsubscribeAll(): void {
  if (!supabase) return;
  for (const channel of activeChannels.values()) {
    supabase.removeChannel(channel);
  }
  activeChannels.clear();
}
