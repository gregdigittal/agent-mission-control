// src/stores/ui-store.ts
"use client";

import { create } from "zustand";
import type { Session, Pane, ScreenProfile, PaneView, TaskStatus, Task } from "@/lib/types";
import { MAX_PANES } from "@/lib/constants";

interface UIState {
  // Sessions from Supabase
  sessions: Record<string, Session>;
  order: string[];
  active: string;

  // Stale sessions
  staleSessions: Record<string, Session>;
  staleOrder: string[];
  staleExpanded: boolean;

  // Layout
  screen: ScreenProfile;
  tiles: number;
  panes: Pane[];

  // Feed
  feedFilter: string;

  // Actions — sessions
  setSessions: (sessions: Session[]) => void;
  upsertSession: (session: Session) => void;
  removeSession: (sid: string) => void;
  setActive: (sid: string) => void;

  // Actions — stale sessions
  setStaleSessions: (sessions: Session[]) => void;
  toggleStaleExpanded: () => void;
  demoteToStale: (sid: string) => void;
  promoteFromStale: (sid: string) => void;

  // Actions — layout
  setScreen: (profile: ScreenProfile) => void;
  setTiles: (n: number) => void;
  setPaneSession: (idx: number, sid: string) => void;
  setPaneView: (idx: number, view: PaneView) => void;

  // Actions — feed
  setFeedFilter: (filter: string) => void;

  // Actions — task approval
  approveTask: (sessionId: string, taskId: string) => void;
  rejectTask: (sessionId: string, taskId: string) => void;

  // Actions — drag
  moveTask: (sessionId: string, taskId: string, newStatus: TaskStatus) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sessions: {},
  order: [],
  active: "",
  staleSessions: {},
  staleOrder: [],
  staleExpanded: false,
  screen: "desktop",
  tiles: 1,
  panes: [{ sid: "", view: "agents" }],
  feedFilter: "all",

  setSessions: (sessions) => {
    const map: Record<string, Session> = {};
    const order: string[] = [];
    sessions.forEach((s) => {
      map[s.id] = s;
      order.push(s.id);
    });
    const active = order[0] || "";
    set({
      sessions: map,
      order,
      active,
      panes: [{ sid: active, view: "agents" }],
    });
  },

  upsertSession: (session) => {
    const { sessions, order, active, panes } = get();
    const newSessions = { ...sessions, [session.id]: session };
    const newOrder = order.includes(session.id)
      ? order
      : [...order, session.id];
    const newActive = active || session.id;
    const newPanes = panes.map((p) =>
      p.sid === "" ? { ...p, sid: newActive } : p
    );
    set({
      sessions: newSessions,
      order: newOrder,
      active: newActive,
      panes: newPanes,
    });
  },

  removeSession: (sid) => {
    const { sessions, order, active, panes } = get();
    const newSessions = { ...sessions };
    delete newSessions[sid];
    const newOrder = order.filter((id) => id !== sid);
    const newActive = active === sid ? (newOrder[0] || "") : active;
    set({
      sessions: newSessions,
      order: newOrder,
      active: newActive,
      panes: panes.map((p) =>
        p.sid === sid ? { ...p, sid: newActive } : p
      ),
    });
  },

  setActive: (sid) => set({ active: sid }),

  setStaleSessions: (sessions) => {
    const map: Record<string, Session> = {};
    const staleOrder: string[] = [];
    sessions.forEach((s) => {
      map[s.id] = s;
      staleOrder.push(s.id);
    });
    set({ staleSessions: map, staleOrder });
  },

  toggleStaleExpanded: () => {
    set({ staleExpanded: !get().staleExpanded });
  },

  demoteToStale: (sid) => {
    const { sessions, order, active, panes, staleSessions, staleOrder } = get();
    const session = sessions[sid];
    if (!session) return;

    // Remove from active
    const newSessions = { ...sessions };
    delete newSessions[sid];
    const newOrder = order.filter((id) => id !== sid);
    const newActive = active === sid ? (newOrder[0] || "") : active;

    // Add to stale
    const newStaleSessions = { ...staleSessions, [sid]: session };
    const newStaleOrder = staleOrder.includes(sid) ? staleOrder : [...staleOrder, sid];

    set({
      sessions: newSessions,
      order: newOrder,
      active: newActive,
      staleSessions: newStaleSessions,
      staleOrder: newStaleOrder,
      panes: panes.map((p) =>
        p.sid === sid ? { ...p, sid: newActive } : p
      ),
    });
  },

  promoteFromStale: (sid) => {
    const { sessions, order, active, staleSessions, staleOrder } = get();
    const session = staleSessions[sid];
    if (!session) return;

    // Remove from stale
    const newStaleSessions = { ...staleSessions };
    delete newStaleSessions[sid];
    const newStaleOrder = staleOrder.filter((id) => id !== sid);

    // Add to active
    const newSessions = { ...sessions, [sid]: session };
    const newOrder = order.includes(sid) ? order : [...order, sid];
    const newActive = active || sid;

    set({
      sessions: newSessions,
      order: newOrder,
      active: newActive,
      staleSessions: newStaleSessions,
      staleOrder: newStaleOrder,
    });
  },

  setScreen: (profile) => {
    const maxP = MAX_PANES[profile] || 3;
    const { tiles, panes } = get();
    const newTiles = Math.min(tiles, maxP);
    set({
      screen: profile,
      tiles: newTiles,
      panes: panes.slice(0, newTiles),
    });
  },

  setTiles: (n) => {
    const { screen, panes, active } = get();
    const max = MAX_PANES[screen] || 3;
    const clamped = Math.min(n, max);
    const newPanes = [...panes];
    while (newPanes.length < clamped) {
      newPanes.push({ sid: active, view: "agents" });
    }
    set({ tiles: clamped, panes: newPanes.slice(0, clamped) });
  },

  setPaneSession: (idx, sid) => {
    const panes = [...get().panes];
    if (panes[idx]) panes[idx] = { ...panes[idx], sid };
    set({ panes });
  },

  setPaneView: (idx, view) => {
    const panes = [...get().panes];
    if (panes[idx]) panes[idx] = { ...panes[idx], view };
    set({ panes });
  },

  setFeedFilter: (filter) => set({ feedFilter: filter }),

  approveTask: (sessionId, taskId) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (!session) return;
    const newState = { ...session.state };
    newState.tasks = newState.tasks.map((t: Task) =>
      t.id === taskId ? { ...t, rec: false, recWhy: "", _auto: false, _prevSt: null, depOf: null } : t
    );
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, state: newState },
      },
    });
  },

  rejectTask: (sessionId, taskId) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (!session) return;
    const newState = { ...session.state };
    newState.tasks = newState.tasks.map((t: Task) => {
      if (t.id !== taskId) return t;
      const revertStatus = t._prevSt || "backlog";
      return { ...t, status: revertStatus, rec: false, recWhy: "", _auto: false, _prevSt: null, depOf: null };
    });
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, state: newState },
      },
    });
  },

  moveTask: (sessionId, taskId, newStatus) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (!session) return;
    const newState = { ...session.state };
    newState.tasks = newState.tasks.map((t: Task) =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    set({
      sessions: {
        ...sessions,
        [sessionId]: { ...session, state: newState },
      },
    });
  },
}));
