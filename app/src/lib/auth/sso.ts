/**
 * SSO helpers — OIDC provider login and callback handling via Supabase Auth.
 *
 * The provider slug is read from VITE_SSO_PROVIDER_SLUG at build time.
 * If unset, SSO is disabled and the SsoButton is not rendered.
 */
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';

// ──────────────────────────────────────────────────────────────────────────────
// initiateSsoLogin
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Redirects the browser to the OIDC provider's auth page.
 * Throws if Supabase is not configured or the provider slug is empty.
 */
export async function initiateSsoLogin(providerSlug: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('[SSO] Supabase is not configured');
  }
  if (!providerSlug) {
    throw new Error('[SSO] providerSlug must not be empty');
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'oidc' as Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'],
    options: {
      // Pass the provider slug so Supabase routes to the correct OIDC config.
      // The slug must match the one configured in the Supabase Dashboard.
      queryParams: { provider_slug: providerSlug },
      redirectTo: window.location.origin,
    },
  });

  if (error) throw new Error(`[SSO] signInWithOAuth failed: ${error.message}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// handleSsoCallback
// ──────────────────────────────────────────────────────────────────────────────

export interface SsoCallbackResult {
  readonly user: User | null;
  readonly error: string | null;
}

/**
 * Exchanges the OIDC callback URL tokens for a Supabase session.
 * Call this once when the app loads at the /auth/callback route (or any route
 * that Supabase redirects back to) so the session is persisted to localStorage.
 */
export async function handleSsoCallback(): Promise<SsoCallbackResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase.auth.getSessionFromUrl({ reHashParams: true });
    if (error) {
      return { user: null, error: error.message };
    }
    return { user: data?.session?.user ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { user: null, error: message };
  }
}
