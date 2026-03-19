import { create } from 'zustand';
import type { Session, Pane, PaneCount, PaneTab, ScreenProfile, SessionColor } from '../types';

const SESSION_COLORS: SessionColor[] = ['cyan', 'green', 'violet', 'amber', 'rose', 'blue'];

/** Detect the current screen profile from window width at call time. */
function detectScreenProfile(): ScreenProfile {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1280) return 'laptop';
  if (w < 1920) return 'desktop';
  return 'ultrawide';
}

interface SessionState {
  sessions: Session[];
  panes: Pane[];
  paneCount: PaneCount;
  activePane: string | null;
  screenProfile: ScreenProfile;
  workspaceId: string | null;

  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;

  setPaneCount: (count: PaneCount) => void;
  setPaneSession: (paneId: string, sessionId: string) => void;
  setPaneProject: (paneId: string, projectId: string) => void;
  setPaneTab: (paneId: string, tab: PaneTab) => void;
  setActivePane: (paneId: string) => void;

  setScreenProfile: (profile: ScreenProfile) => void;

  setWorkspaceId: (id: string | null) => void;

  nextSessionColor: () => SessionColor;

  updateSession: (id: string, updates: Partial<Session>) => void;

  refreshTick: number;
  triggerRefresh: () => void;
}

function buildPanes(count: PaneCount, existing: Pane[]): Pane[] {
  const panes: Pane[] = [];
  for (let i = 0; i < count; i++) {
    panes.push(existing[i] ?? {
      id: `pane-${i + 1}`,
      sessionId: '',
      activeTab: 'agents' as PaneTab,
      projectId: '',
    });
  }
  return panes;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  panes: buildPanes(1, []),
  paneCount: 1,
  activePane: 'pane-1',
  // Initialised from window.innerWidth at store creation time so that
  // useScreenProfile's mount effect does not need to call set() on first render,
  // avoiding the useSyncExternalStore cascade that causes React error #185.
  screenProfile: detectScreenProfile(),
  workspaceId: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session] })),

  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((s) => s.id !== id),
      panes: s.panes.map((p) =>
        p.sessionId === id ? { ...p, sessionId: '' } : p,
      ),
    })),

  setPaneCount: (count) =>
    set((s) => ({
      paneCount: count,
      panes: buildPanes(count, s.panes),
    })),

  setPaneSession: (paneId, sessionId) =>
    set((s) => ({
      panes: s.panes.map((p) => (p.id === paneId ? { ...p, sessionId } : p)),
    })),

  setPaneProject: (paneId, projectId) =>
    set((s) => ({
      panes: s.panes.map((p) =>
        p.id === paneId ? { ...p, projectId, sessionId: '' } : p,
      ),
    })),

  setPaneTab: (paneId, tab) =>
    set((s) => ({
      panes: s.panes.map((p) => (p.id === paneId ? { ...p, activeTab: tab } : p)),
    })),

  setActivePane: (paneId) => set({ activePane: paneId }),

  setScreenProfile: (profile) => {
    // Apply class to <html> and store
    const classes = ['screen-mobile', 'screen-laptop', 'screen-desktop', 'screen-ultrawide'];
    document.documentElement.classList.remove(...classes);
    document.documentElement.classList.add(`screen-${profile}`);
    set({ screenProfile: profile });
  },

  setWorkspaceId: (id) => set({ workspaceId: id }),

  nextSessionColor: () => {
    const used = get().sessions.map((s) => s.color);
    return SESSION_COLORS.find((c) => !used.includes(c)) ?? 'cyan';
  },

  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, ...updates } : sess,
      ),
    })),

  refreshTick: 0,
  triggerRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));
