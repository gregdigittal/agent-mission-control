/**
 * SsoButton — "Sign in with SSO" button.
 *
 * Rendered only when VITE_SSO_PROVIDER_SLUG is set.
 * Calls initiateSsoLogin() which redirects to the OIDC provider.
 */
import { useState } from 'react';
import { initiateSsoLogin } from '../../lib/auth/sso';

const PROVIDER_SLUG = import.meta.env.VITE_SSO_PROVIDER_SLUG as string | undefined;

export function SsoButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hidden when the env var is not set
  if (!PROVIDER_SLUG) return null;

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      await initiateSsoLogin(PROVIDER_SLUG as string);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'SSO login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          width: '100%', padding: '9px 0', borderRadius: 4, fontSize: 13,
          background: 'var(--bg-4)', border: '1px solid var(--border-2)',
          color: 'var(--text-1)', opacity: loading ? 0.5 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Redirecting…' : 'Sign in with SSO'}
      </button>
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
