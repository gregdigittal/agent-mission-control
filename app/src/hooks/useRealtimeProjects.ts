import { useEffect } from 'react';
import { subscribeToTable } from '../lib/realtime';
import { useProjectStore } from '../stores/projectStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Project } from '../types';

/**
 * Subscribes to the projects table and keeps projectStore in sync.
 * Handles INSERT and UPDATE events.
 */
export function useRealtimeProjects(): void {
  const { setProjects, addProject, updateProject } = useProjectStore();

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Initial load — fetch all projects ordered by name
    supabase
      .from('projects')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) { console.error('[projects] load error:', error); return; }
        if (data) setProjects(data as Project[]);
      });

    const unsub = subscribeToTable('projects', (payload) => {
      const p = payload as { eventType: string; new: Project; old: { id: string } };
      if (p.eventType === 'INSERT' && p.new) {
        addProject(p.new);
      } else if (p.eventType === 'UPDATE' && p.new) {
        updateProject(p.new.id, p.new);
      }
    });

    return unsub;
  }, [setProjects, addProject, updateProject]);
}
