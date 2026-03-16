import { useEffect } from 'react';
import { subscribeToTable } from '../lib/realtime';
import { useAgentStore } from '../stores/agentStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Agent, AgentEvent } from '../types';

export function useRealtimeAgents(sessionId: string): void {
  const { setAgents, updateAgent } = useAgentStore();

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Initial load
    supabase
      .from('agents')
      .select('*')
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (error) { console.error('[agents] load error:', error); return; }
        if (data) setAgents(data as Agent[]);
      });

    // Realtime updates
    const unsub = subscribeToTable('agents', (payload) => {
      const record = (payload as { new: Agent }).new;
      if (record?.sessionId === sessionId) {
        updateAgent(record.id, record);
      }
    });

    return unsub;
  }, [sessionId, setAgents, updateAgent]);
}

export function useRealtimeEvents(sessionId: string): void {
  const { setEvents, prependEvent } = useAgentStore();

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Initial load — last 100 events
    supabase
      .from('events')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) { console.error('[events] load error:', error); return; }
        if (data) setEvents(data as AgentEvent[]);
      });

    // Realtime new events
    const unsub = subscribeToTable('events', (payload) => {
      const record = (payload as { new: AgentEvent; eventType: string }).new;
      if ((payload as { eventType: string }).eventType === 'INSERT' && record?.sessionId === sessionId) {
        prependEvent(record);
      }
    });

    return unsub;
  }, [sessionId, setEvents, prependEvent]);
}
