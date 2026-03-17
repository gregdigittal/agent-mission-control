---
id: sso
title: SSO / OIDC Integration
sidebar_position: 1
---

# SSO / OIDC Integration

Agent Mission Control supports Single Sign-On via OIDC (OpenID Connect) through Supabase Auth. Compatible with any OIDC-compliant provider: Azure AD, Okta, Auth0, Google Workspace, Keycloak, and others.

## How It Works

1. User clicks **Sign in with SSO** on the login page
2. Browser redirects to the OIDC provider's login page
3. After authentication, the provider redirects back to the AMC callback URL
4. Supabase exchanges the OIDC tokens for a session JWT
5. A `profiles` row is created automatically for first-time SSO users
6. The dashboard loads with the authenticated user's identity

## Prerequisites

- A configured Supabase project
- An OIDC-compliant identity provider (IdP)
- `VITE_SSO_PROVIDER_SLUG` set in the React app's environment variables

## Step 1 — Configure the OIDC Provider in Supabase

1. Open **Supabase Dashboard** → **Authentication** → **Providers**
2. Find your provider (e.g. "OIDC", "Azure AD", "Auth0")
3. Enable the provider and fill in:

   | Field | Value |
   |-------|-------|
   | **Client ID** | From your IdP application settings |
   | **Client Secret** | From your IdP application settings |
   | **Issuer URL** | The OIDC discovery base URL (e.g. `https://login.microsoftonline.com/{tenant}/v2.0`) |
   | **Provider Slug** | A URL-safe identifier (e.g. `my-company`) — you will set this in the app env |

4. In your IdP application, add the Supabase redirect URI:
   ```
   https://<your-project>.supabase.co/auth/v1/callback
   ```

5. Save and test the login flow from **Authentication** → **Users** in the Supabase Dashboard.

## Step 2 — Configure the React App

Set the following environment variables in `app/.env` (or Vercel project settings):

```bash
# Provider slug must match what you set in the Supabase Dashboard
VITE_SSO_PROVIDER_SLUG=my-company
```

When `VITE_SSO_PROVIDER_SLUG` is set, the **Sign in with SSO** button appears automatically on the login page. When unset, the button is hidden.

## Step 3 — Add the Callback Route

The `SsoCallback` component handles the OIDC redirect. Register it at `/auth/callback` in your router:

```tsx
import { SsoCallback } from './components/auth/SsoCallback';

// In your router configuration:
<Route path="/auth/callback" element={<SsoCallback />} />
```

Also add the callback URL to your `app/.env`:

```bash
# Must match the redirect URI registered in your IdP
VITE_SSO_REDIRECT_URL=https://your-amc-app.vercel.app/auth/callback
```

## Step 4 — Apply the SSO Migration

The migration `supabase/migrations/004_sso_config.sql` creates a trigger that automatically creates a `profiles` row for new SSO users.

If you are using the hosted Supabase project, apply it via the Supabase CLI:

```bash
supabase db push
```

Or copy-paste the SQL into the Supabase SQL Editor.

## Security Considerations

- OIDC tokens are exchanged server-side by Supabase — the client never receives raw tokens
- The `SsoCallback` component does not log or expose authentication tokens
- The `profiles` trigger uses `SECURITY DEFINER` with a fixed `search_path` to prevent search-path hijacking
- SSO sessions are subject to the same RLS policies as email/password sessions
- No SAML assertion or token is logged at any level in the AMC application code

## Provider-Specific Notes

### Azure AD (Entra ID)

Issuer URL format: `https://login.microsoftonline.com/{tenant-id}/v2.0`

In the Azure app registration, add `https://<your-project>.supabase.co/auth/v1/callback` as a redirect URI under **Authentication** → **Web**.

### Okta

Issuer URL format: `https://{your-okta-domain}/oauth2/default`

In Okta, add the Supabase redirect URI under **Okta Application** → **Sign-On** → **OpenID Connect ID Token**.

### Auth0

Issuer URL format: `https://{your-auth0-domain}/`

In the Auth0 application, add the Supabase redirect URI under **Application URIs** → **Allowed Callback URLs**.

## Troubleshooting

**"Sign in with SSO" button not appearing:**
- Verify `VITE_SSO_PROVIDER_SLUG` is set in your `.env` file
- Check that the env var is prefixed with `VITE_` (Vite strips all other env vars at build time)
- Restart the dev server after adding the env var

**Redirect fails with "Invalid redirect_uri":**
- Verify the exact redirect URI registered in your IdP matches `https://<supabase-project>.supabase.co/auth/v1/callback`
- Check for trailing slashes — they must match exactly

**User signed in but no profile row created:**
- Check the `on_sso_user_created` trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_sso_user_created';`
- Verify migration `004_sso_config.sql` was applied
- Check the Supabase database logs for trigger errors
