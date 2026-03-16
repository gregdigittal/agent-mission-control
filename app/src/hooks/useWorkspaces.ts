/**
 * useWorkspaces — fetches workspaces from Supabase.
 *
 * If the workspaces table does not exist yet, or Supabase is not configured,
 * returns a single "Personal" workspace as a graceful fallback.
 *
 * TODO[agent-app-core]: supabase/migrations/003_workspaces.sql needs to be created
 * Schema: CREATE TABLE workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, owner_id uuid REFERENCES profiles(id), created_at timestamptz DEFAULT now());
 * RLS: SELECT for authenticated users who own or are members of the workspace.
 */
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// Type
// ──────────────────────────────────────────────────────────────────────────────

export type Workspace = {
  readonly id: string;
  readonly name: string;
  readonly ownerUid: string;
  readonly createdAt: string;
};

const PERSONAL_WORKSPACE: Workspace = {
  id: 'personal',
  name: 'Personal',
  ownerUid: '',
  createdAt: '',
};

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

interface UseWorkspacesResult {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
}

export function useWorkspaces(): UseWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([PERSONAL_WORKSPACE]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      // Supabase not configured — stay with Personal fallback
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('workspaces')
      .select('id, name, owner_id, created_at')
      .order('created_at', { ascending: true })
      .then(({ data, error: sbError }) => {
        if (cancelled) return;
        setLoading(false);

        if (sbError) {
          // Common case: table doesn't exist yet (error code 42P01 in PostgreSQL)
          // Fall back gracefully to Personal workspace
          console.warn('[useWorkspaces] Could not fetch workspaces — falling back to Personal:', sbError.message);
          setWorkspaces([PERSONAL_WORKSPACE]);
          setError(null); // not surfacing this to users — it's expected pre-migration
          return;
        }

        if (!data || data.length === 0) {
          setWorkspaces([PERSONAL_WORKSPACE]);
          return;
        }

        const mapped: Workspace[] = data.map((row) => ({
          id:        row.id as string,
          name:      row.name as string,
          ownerUid:  (row.owner_id as string | null) ?? '',
          createdAt: (row.created_at as string | null) ?? '',
        }));

        setWorkspaces(mapped);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[useWorkspaces] Unexpected error — falling back to Personal:', message);
        setWorkspaces([PERSONAL_WORKSPACE]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { workspaces, loading, error };
}
