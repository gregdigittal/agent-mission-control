import { useEffect, useRef } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAgentStore } from '../stores/agentStore';
import { useKanbanStore } from '../stores/kanbanStore';
import { useSessionStore } from '../stores/sessionStore';
import type { DashboardState } from '../types';

const POLL_INTERVAL = 3000;
const STATE_PATH = import.meta.env.VITE_BRIDGE_STATE_PATH as string | undefined;

export function useOfflineFallback(): void {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only activate when Supabase is not configured
    if (isSupabaseConfigured() || !STATE_PATH) return;

    async function poll() {
      try {
        const res = await fetch(STATE_PATH!);
        if (!res.ok) return;
        const state: DashboardState = await res.json();
        applyState(state);
      } catch {
        // Silently ignore fetch errors in fallback mode
      }
    }

    poll();
    timer.current = setInterval(poll, POLL_INTERVAL);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);
}

function applyState(state: DashboardState): void {
  useAgentStore.getState().setAgents(state.agents ?? []);
  useAgentStore.getState().setEvents(state.events ?? []);
  useKanbanStore.getState().setTasks(state.tasks ?? []);
  useSessionStore.getState().setSessions(state.sessions ?? []);
}
