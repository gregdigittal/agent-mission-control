/**
 * SsoCallback — handles the OIDC redirect after the user authenticates
 * with their identity provider.
 *
 * Supabase redirects back to the app URL after authentication. When this
 * component mounts, it exchanges the URL tokens for a session, then
 * navigates to the dashboard. It handles errors by displaying a message
 * and providing a way back to the login page.
 *
 * Route: /auth/callback  (or wherever VITE_SSO_REDIRECT_URL points)
 */
import { useEffect, useState } from 'react';
import { handleSsoCallback } from '../../lib/auth/sso';
import { useAuthStore } from '../../stores/authStore';

export function SsoCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { session } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function exchange() {
      const result = await handleSsoCallback();

      if (cancelled) return;

      if (result.error) {
        setErrorMessage(result.error);
        setStatus('error');
        return;
      }

      if (result.user) {
        setStatus('success');
        // Give auth store a moment to pick up the new session from Supabase,
        // then redirect to the app root. A real router would use navigate('/'),
        // but we keep this component router-agnostic by using window.location.
        setTimeout(() => {
          if (!cancelled) window.location.replace('/');
        }, 800);
      } else {
        // No error, no user — unexpected state (e.g. callback URL visited directly)
        setErrorMessage('No session was established. Please try signing in again.');
        setStatus('error');
      }
    }

    void exchange();

    return () => { cancelled = true; };
  }, []);

  // If the auth store already has a session (e.g. user navigated back),
  // redirect immediately instead of running the exchange again.
  useEffect(() => {
    if (session && status === 'loading') {
      window.location.replace('/');
    }
  }, [session, status]);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: 360, background: 'var(--bg-1)',
        border: '1px solid var(--border-1)', borderRadius: 8, padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          color: 'var(--cyan)', fontSize: 16, letterSpacing: 0.5, marginBottom: 24,
        }}>
          AGENT<span style={{ color: 'var(--text-2)', fontWeight: 400 }}>/MC</span>
        </div>

        {status === 'loading' && (
          <>
            <div style={{ color: 'var(--text-1)', fontSize: 14, marginBottom: 8 }}>
              Completing sign-in…
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
              Exchanging tokens with your identity provider.
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ color: 'var(--green)', fontSize: 14, marginBottom: 8 }}>
              Signed in successfully
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
              Redirecting to dashboard…
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 8 }}>
              Sign-in failed
            </div>
            {errorMessage && (
              <div style={{
                background: 'var(--bg-3)', border: '1px solid var(--red)',
                borderRadius: 6, padding: '8px 12px', marginBottom: 16,
                color: 'var(--text-2)', fontSize: 12, textAlign: 'left',
              }}>
                {errorMessage}
              </div>
            )}
            <a
              href="/login"
              style={{
                display: 'inline-block', padding: '8px 20px', borderRadius: 4,
                background: 'var(--bg-4)', border: '1px solid var(--border-2)',
                color: 'var(--text-1)', fontSize: 13, textDecoration: 'none',
              }}
            >
              Back to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
