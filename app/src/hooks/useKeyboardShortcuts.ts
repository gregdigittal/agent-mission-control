import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { PaneCount, PaneTab } from '../types';

export function useKeyboardShortcuts(): void {
  const { screenProfile, setPaneCount, setPaneTab, panes, activePane } = useSessionStore();

  useEffect(() => {
    if (screenProfile === 'mobile') return;

    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Pane layout: 1-4
      if (e.key >= '1' && e.key <= '4' && !e.metaKey && !e.ctrlKey) {
        setPaneCount(Number(e.key) as PaneCount);
        return;
      }

      // Tab switching: A=agents, K=kanban, C=costs, P=approvals
      const tabMap: Record<string, PaneTab> = {
        a: 'agents', k: 'kanban', c: 'costs', p: 'approvals',
      };
      const tab = tabMap[e.key.toLowerCase()];
      if (tab && activePane) {
        setPaneTab(activePane, tab);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screenProfile, setPaneCount, setPaneTab, panes, activePane]);
}
