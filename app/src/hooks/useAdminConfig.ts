/**
 * useAdminConfig — fetches and updates admin_config for the current workspace.
 *
 * Exposes:
 *   config     — current admin_config row, or null if none exists yet
 *   updateConfig — upserts the row; only callable when isOwner === true
 *   isOwner    — true when the authenticated user owns the active workspace
 *   loading    — true while the initial fetch is in-flight
 *   error      — error message from the last operation, or null
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useWorkspaces } from './useWorkspaces';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface AdminConfig {
  readonly id: string;
  readonly workspaceId: string;
  readonly maxSessionBudgetCents: number | null;
  readonly maxAgentBudgetCents: number | null;
  readonly allowedModels: string[] | null;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

export interface AdminConfigUpdate {
  maxSessionBudgetCents: number | null;
  maxAgentBudgetCents: number | null;
  allowedModels: string[] | null;
}

interface UseAdminConfigResult {
  config: AdminConfig | null;
  updateConfig: (update: AdminConfigUpdate) => Promise<void>;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: map raw Supabase row to AdminConfig
// ──────────────────────────────────────────────────────────────────────────────

export function rowToConfig(row: Record<string, unknown>): AdminConfig {
  return {
    id:                      row.id as string,
    workspaceId:             row.workspace_id as string,
    maxSessionBudgetCents:   (row.max_session_budget_cents as number | null) ?? null,
    maxAgentBudgetCents:     (row.max_agent_budget_cents as number | null) ?? null,
    allowedModels:           (row.allowed_models as string[] | null) ?? null,
    updatedAt:               row.updated_at as string,
    updatedBy:               (row.updated_by as string | null) ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export function useAdminConfig(): UseAdminConfigResult {
  const { user }       = useAuthStore();
  const { workspaceId } = useSessionStore();
  const { workspaces }  = useWorkspaces();

  const [config, setConfig]   = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Determine whether the current user owns the active workspace.
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
  const isOwner = Boolean(user && activeWorkspace && activeWorkspace.ownerUid === user.id);

  // Fetch admin_config for the current workspace.
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || !workspaceId) {
      setConfig(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('admin_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
      .then(({ data, error: sbError }) => {
        if (cancelled) return;
        setLoading(false);

        if (sbError) {
          console.warn('[useAdminConfig] Fetch error:', sbError.message);
          setError(sbError.message);
          return;
        }

        setConfig(data ? rowToConfig(data as Record<string, unknown>) : null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[useAdminConfig] Unexpected error:', message);
        setError(message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Upsert admin_config for the current workspace.
  const updateConfig = useCallback(
    async (update: AdminConfigUpdate): Promise<void> => {
      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('[useAdminConfig] Supabase is not configured');
      }
      if (!workspaceId) {
        throw new Error('[useAdminConfig] No active workspace');
      }
      if (!isOwner) {
        throw new Error('[useAdminConfig] Only the workspace owner can update admin config');
      }

      setError(null);

      const payload = {
        workspace_id:              workspaceId,
        max_session_budget_cents:  update.maxSessionBudgetCents,
        max_agent_budget_cents:    update.maxAgentBudgetCents,
        allowed_models:            update.allowedModels,
        updated_at:                new Date().toISOString(),
        updated_by:                user?.id ?? null,
      };

      const { data, error: sbError } = await supabase
        .from('admin_config')
        .upsert(payload, { onConflict: 'workspace_id' })
        .select()
        .single();

      if (sbError) {
        const message = sbError.message;
        setError(message);
        throw new Error(`[useAdminConfig] upsert failed: ${message}`);
      }

      if (data) {
        setConfig(rowToConfig(data as Record<string, unknown>));
      }
    },
    [workspaceId, isOwner, user],
  );

  return { config, updateConfig, isOwner, loading, error };
}
