import { useEffect } from 'react';
import { AuthGuard } from './components/auth/AuthGuard';
import { Topbar } from './components/topbar/Topbar';
import { PaneContainer } from './components/panes/PaneContainer';
import { BottomNav } from './components/mobile/BottomNav';
import { useSessionStore } from './stores/sessionStore';
import { useScreenProfile } from './hooks/useScreenProfile';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useOfflineFallback } from './hooks/useOfflineFallback';
import { initAuth } from './stores/authStore';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const { panes, paneCount } = useSessionStore();
  const screenProfile = useScreenProfile();
  useKeyboardShortcuts();
  useOfflineFallback();

  useEffect(() => {
    const cleanup = initAuth();
    return cleanup;
  }, []);

  const isMobile = screenProfile === 'mobile';
  const visiblePanes = isMobile ? panes.slice(0, 1) : panes.slice(0, paneCount);
  const isOnline = isSupabaseConfigured();

  return (
    <AuthGuard>
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-0)', overflow: 'hidden',
      }}>
        <Topbar isOnline={isOnline} />

        <main style={{
          flex: 1, display: 'flex', overflow: 'hidden',
          paddingBottom: isMobile ? 'var(--bottomnav-h)' : 0,
        }}>
          {visiblePanes.map((pane) => (
            <PaneContainer key={pane.id} paneId={pane.id} />
          ))}
        </main>

        {isMobile && <BottomNav />}
      </div>
    </AuthGuard>
  );
}
