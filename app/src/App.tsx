import { useCallback, useEffect } from 'react';
import { AuthGuard } from './components/auth/AuthGuard';
import { Topbar } from './components/topbar/Topbar';
import { PaneContainer } from './components/panes/PaneContainer';
import { BottomNav } from './components/mobile/BottomNav';
import { useSessionStore } from './stores/sessionStore';
import { useScreenProfile } from './hooks/useScreenProfile';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useOfflineFallback } from './hooks/useOfflineFallback';
import { useRealtimeSessions } from './hooks/useRealtimeSessions';
import { useRealtimeProjects } from './hooks/useRealtimeProjects';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { initAuth } from './stores/authStore';
import { isSupabaseConfigured } from './lib/supabase';
import type { PaneTab } from './types';

const MOBILE_TABS: PaneTab[] = ['agents', 'kanban', 'costs', 'approvals'];

export default function App() {
  const { panes, paneCount, activePane, setPaneTab, triggerRefresh } = useSessionStore();
  const screenProfile = useScreenProfile();
  useKeyboardShortcuts();
  useOfflineFallback();
  useRealtimeSessions();
  useRealtimeProjects();

  useEffect(() => {
    const cleanup = initAuth();
    return cleanup;
  }, []);

  const isMobile = screenProfile === 'mobile';
  const visiblePanes = isMobile ? panes.slice(0, 1) : panes.slice(0, paneCount);
  const isOnline = isSupabaseConfigured();

  // Mobile: swipe left/right cycles through tabs in the active pane
  const activePaneObj = panes.find((p) => p.id === activePane) ?? panes[0];
  const cycleTab = useCallback((direction: 1 | -1) => {
    if (!activePaneObj) return;
    const idx = MOBILE_TABS.indexOf(activePaneObj.activeTab as PaneTab);
    const next = MOBILE_TABS[(idx + direction + MOBILE_TABS.length) % MOBILE_TABS.length];
    setPaneTab(activePaneObj.id, next);
  }, [activePaneObj, setPaneTab]);

  const mainRef = useSwipeGesture<HTMLElement>({
    onSwipeLeft: isMobile ? () => cycleTab(1) : undefined,
    onSwipeRight: isMobile ? () => cycleTab(-1) : undefined,
  });

  // Mobile: pull-to-refresh triggers a data re-fetch in all realtime hooks
  const handleRefresh = useCallback(() => { triggerRefresh(); }, [triggerRefresh]);
  const { containerRef: pullRef, isRefreshing } = usePullToRefresh(handleRefresh);

  // Merge swipe + pull refs onto <main>
  const setMainRef = useCallback((el: HTMLElement | null) => {
    (mainRef as React.MutableRefObject<HTMLElement | null>).current = el;
    (pullRef as React.MutableRefObject<HTMLElement | null>).current = el;
  }, [mainRef, pullRef]);

  return (
    <AuthGuard>
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-0)', overflow: 'hidden',
      }}>
        <Topbar isOnline={isOnline} />

        {isMobile && isRefreshing && (
          <div style={{
            textAlign: 'center', padding: '6px 0',
            fontSize: 'var(--font-xs)', color: 'var(--cyan)',
            background: 'var(--bg-1)', borderBottom: '1px solid var(--border-0)',
          }}>
            Refreshing…
          </div>
        )}

        <main
          ref={setMainRef}
          style={{
            flex: 1, display: 'flex', overflow: 'hidden',
            paddingBottom: isMobile ? 'var(--bottomnav-h)' : 0,
          }}
        >
          {visiblePanes.map((pane) => (
            <PaneContainer key={pane.id} paneId={pane.id} />
          ))}
        </main>

        {isMobile && <BottomNav />}
      </div>
    </AuthGuard>
  );
}
