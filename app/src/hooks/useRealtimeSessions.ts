import { useEffect } from 'react';
import { subscribeToTable } from '../lib/realtime';
import { useSessionStore } from '../stores/sessionStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session } from '../types';

/**
 * Subscribes to the agent_sessions table and keeps sessionStore in sync.
 * Handles INSERT, UPDATE, and DELETE events.
 */
export function useRealtimeSessions(): void {
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Access store actions at call time to avoid subscribing the parent component
    // to the entire sessionStore on every render
    const { setSessions, addSession, updateSession, removeSession } = useSessionStore.getState();

    // Initial load — RLS filters to sessions visible to the current user
    supabase
      .from('agent_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('[sessions] load error:', error); return; }
        if (data) setSessions(data as Session[]);
      });

    const unsub = subscribeToTable('agent_sessions', (payload) => {
      const p = payload as { eventType: string; new: Session; old: { id: string } };
      if (p.eventType === 'INSERT' && p.new) {
        addSession(p.new);
      } else if (p.eventType === 'UPDATE' && p.new) {
        updateSession(p.new.id, p.new);
      } else if (p.eventType === 'DELETE' && p.old?.id) {
        removeSession(p.old.id);
      }
    });

    return unsub;
  }, []);
}
