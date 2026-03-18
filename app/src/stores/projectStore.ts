import { create } from 'zustand';
import type { Project } from '../types';

interface ProjectState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((s) => ({ projects: [...s.projects, project] })),

  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    })),
}));
