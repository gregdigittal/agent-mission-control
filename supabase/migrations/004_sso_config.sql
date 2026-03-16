-- Migration: 004_sso_config
-- Owner: agent-api-2 (M8-002)
--
-- ── Manual Dashboard Steps to Enable an OIDC Provider ────────────────────────
--
-- Supabase Auth handles OIDC natively.  No SQL schema changes are required to
-- enable an OIDC provider — configuration is done entirely in the Supabase
-- Dashboard.  The steps below document what a workspace admin must do:
--
-- 1. Open: Supabase Dashboard → Authentication → Providers
-- 2. Find "OIDC" (or the specific provider, e.g. "Azure AD", "Okta", "Auth0").
-- 3. Enable the provider toggle.
-- 4. Fill in:
--      • Client ID       — from your IdP application settings
--      • Client Secret   — from your IdP application settings
--      • Issuer URL      — the OIDC discovery base URL, e.g.
--                          https://login.microsoftonline.com/{tenant}/v2.0
-- 5. Set the "Provider Slug" to the value you will put in VITE_SSO_PROVIDER_SLUG.
--    The slug must be URL-safe (lowercase letters, digits, hyphens only).
-- 6. In your IdP application, add the Supabase redirect URI:
--      https://<your-project>.supabase.co/auth/v1/callback
-- 7. Save.  Test a login flow from the Supabase Auth → Users tab.
--
-- ── Profiles row on first SSO login ──────────────────────────────────────────
--
-- When a user signs in via SSO for the first time, Supabase creates a row in
-- auth.users but NOT in public.profiles.  The trigger below ensures a profiles
-- row is inserted automatically using the SSO identity metadata.
--
-- NOTE: If migration 002_rls_policies.sql already defines a
-- handle_new_user() trigger on auth.users, extend that function instead of
-- adding a second trigger.  Inspect the existing function body and merge the
-- profile-upsert logic rather than duplicate it.

-- ── Trigger function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_sso_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Use the search_path to prevent search-path hijacking.
SET search_path = public
AS $$
BEGIN
  -- Insert a profile row only if one does not already exist.
  -- SSO metadata is stored in raw_user_meta_data / raw_app_meta_data.
  INSERT INTO public.profiles (id, email, display_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── Trigger ───────────────────────────────────────────────────────────────────

-- Drop the trigger first so this migration is idempotent on re-runs.
DROP TRIGGER IF EXISTS on_sso_user_created ON auth.users;

CREATE TRIGGER on_sso_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  -- Only fire for SSO / OAuth providers, not email/password signups.
  -- Supabase sets app_metadata.provider for OAuth logins.
  WHEN (NEW.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email')
  EXECUTE FUNCTION public.handle_new_sso_user();
