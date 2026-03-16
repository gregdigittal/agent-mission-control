import { create } from 'zustand';
import type { KanbanTask, KanbanStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface KanbanState {
  tasks: KanbanTask[];
  draggingId: string | null;

  setTasks: (tasks: KanbanTask[]) => void;
  addTask: (task: KanbanTask) => void;
  updateTask: (id: string, update: Partial<KanbanTask>) => void;
  moveTask: (id: string, newStatus: KanbanStatus) => Promise<void>;
  approveTask: (id: string) => Promise<void>;
  setDragging: (id: string | null) => void;

  tasksBySession: (sessionId: string) => KanbanTask[];
  tasksByStatus: (sessionId: string, status: KanbanStatus) => KanbanTask[];
}

// Valid state transitions
const VALID_TRANSITIONS: Record<KanbanStatus, KanbanStatus[]> = {
  backlog: ['todo', 'blocked'],
  todo: ['in_progress', 'blocked', 'backlog'],
  in_progress: ['review', 'blocked', 'todo'],
  review: ['done', 'in_progress', 'blocked'],
  done: [],
  blocked: ['todo', 'in_progress', 'backlog'],
};

export const useKanbanStore = create<KanbanState>((set, get) => ({
  tasks: [],
  draggingId: null,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (id, update) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...update } : t)),
    })),

  moveTask: async (id, newStatus) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed.includes(newStatus)) {
      console.warn(`[kanban] Invalid transition: ${task.status} → ${newStatus}`);
      return;
    }

    // Approval-gated tasks can't go to in_progress without approval
    if (task.approvalRequired && !task.approvedAt && newStatus === 'in_progress') {
      console.warn('[kanban] Task requires approval before starting');
      return;
    }

    get().updateTask(id, { status: newStatus, updatedAt: new Date().toISOString() });

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('kanban_tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) console.error('[kanban] Failed to sync move:', error);
    }
  },

  approveTask: async (id) => {
    const approvedAt = new Date().toISOString();
    get().updateTask(id, { approvedAt, updatedAt: approvedAt });

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('kanban_tasks')
        .update({ approved_at: approvedAt, updated_at: approvedAt })
        .eq('id', id);
      if (error) console.error('[kanban] Failed to sync approval:', error);
    }
  },

  setDragging: (id) => set({ draggingId: id }),

  tasksBySession: (sessionId) =>
    get().tasks.filter((t) => t.sessionId === sessionId),

  tasksByStatus: (sessionId, status) =>
    get().tasks.filter((t) => t.sessionId === sessionId && t.status === status),
}));
