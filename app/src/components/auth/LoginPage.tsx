import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { SsoButton } from './SsoButton';

export function LoginPage() {
  const { signInWithEmail, signInWithGitHub, signUp, loading } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signupSent, setSignupSent] = useState(false);
  const [githubError, setGithubError] = useState('');

  const noSupabase = !isSupabaseConfigured();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUp(email, password);
        setSignupSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  async function handleGitHub() {
    setGithubError('');
    try {
      await signInWithGitHub();
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'GitHub sign-in failed');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: 360, background: 'var(--bg-1)',
        border: '1px solid var(--border-1)', borderRadius: 8, padding: 32,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            color: 'var(--cyan)', fontSize: 16, letterSpacing: 0.5, marginBottom: 4,
          }}>
            AGENT<span style={{ color: 'var(--text-2)', fontWeight: 400 }}>/MC</span>
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Mission Control</div>
        </div>

        {noSupabase && (
          <div style={{
            background: 'var(--bg-3)', border: '1px solid var(--amber)',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: 'var(--amber)', fontSize: 12,
          }}>
            Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 4, fontSize: 12,
                background: mode === m ? 'var(--bg-4)' : 'transparent',
                color: mode === m ? 'var(--text-0)' : 'var(--text-2)',
                border: `1px solid ${mode === m ? 'var(--border-2)' : 'transparent'}`,
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {signupSent ? (
          <div style={{
            textAlign: 'center', padding: '16px 0',
          }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>📧</div>
            <div style={{ color: 'var(--text-0)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Check your email
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: 12, lineHeight: 1.5 }}>
              We sent a confirmation link to <strong style={{ color: 'var(--text-1)' }}>{email}</strong>.
              Click it to activate your account, then come back and sign in.
            </div>
            <button
              onClick={() => { setSignupSent(false); setMode('login'); }}
              style={{
                marginTop: 16, padding: '7px 16px', borderRadius: 4, fontSize: 12,
                background: 'var(--bg-4)', border: '1px solid var(--border-2)',
                color: 'var(--text-1)',
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required disabled={noSupabase}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
              />
              <input
                type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                required disabled={noSupabase}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
              />

              {error && (
                <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || noSupabase}
                style={{
                  padding: '9px 0', borderRadius: 4, fontSize: 13, fontWeight: 600,
                  background: 'var(--cyan)', color: '#06080c',
                  opacity: (loading || noSupabase) ? 0.5 : 1,
                }}
              >
                {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div style={{ margin: '16px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 11 }}>
              OR
            </div>

            <button
              onClick={handleGitHub}
              disabled={noSupabase}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 4, fontSize: 13,
                background: 'var(--bg-4)', border: '1px solid var(--border-2)',
                color: 'var(--text-1)', opacity: noSupabase ? 0.5 : 1,
              }}
            >
              Continue with GitHub
            </button>

            {githubError && (
              <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{githubError}</div>
            )}
          </>
        )}

        <SsoButton />
      </div>
    </div>
  );
}
