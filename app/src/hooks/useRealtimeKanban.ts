import { useEffect } from 'react';
import { subscribeToTable } from '../lib/realtime';
import { useKanbanStore } from '../stores/kanbanStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { KanbanTask } from '../types';

export function useRealtimeKanban(sessionId: string): void {
  const { setTasks, updateTask, addTask } = useKanbanStore();

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    supabase
      .from('kanban_tasks')
      .select('*')
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (error) { console.error('[kanban] load error:', error); return; }
        if (data) setTasks(data as KanbanTask[]);
      });

    const unsub = subscribeToTable('kanban_tasks', (payload) => {
      const p = payload as { eventType: string; new: KanbanTask };
      if (!p.new || p.new.sessionId !== sessionId) return;
      if (p.eventType === 'INSERT') addTask(p.new);
      else if (p.eventType === 'UPDATE') updateTask(p.new.id, p.new);
    });

    return unsub;
  }, [sessionId, setTasks, updateTask, addTask]);
}
