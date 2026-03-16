import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { LoginPage } from './LoginPage';

interface Props {
  children: ReactNode;
}

export function AuthGuard({ children }: Props) {
  const { user, initialized } = useAuthStore();

  // If Supabase isn't configured, allow access (offline/local mode)
  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

  if (!initialized) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-0)', color: 'var(--text-2)', fontSize: 13,
      }}>
        <div style={{
          width: 20, height: 20, border: '2px solid var(--cyan)',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 1s linear infinite', marginRight: 10,
        }} />
        Connecting…
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <>{children}</>;
}
