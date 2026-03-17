/**
 * Admin policy — per-workspace budget and model restriction enforcement.
 *
 * Fetches the admin_config row from Supabase for the active workspace and
 * exposes pure-function checks that spawn.ts and the health checker use
 * to enforce operational limits before starting agents.
 *
 * When Supabase is unavailable, or no policy row exists, a permissive default
 * policy is returned so the bridge continues operating in degraded mode.
 */

import { getSupabaseClient } from '../supabase/client.js';
import { audit } from '../audit/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type AdminPolicy = {
  readonly workspaceId: string | null;
  /** Maximum total cost in US cents for a single session. null = no cap. */
  readonly maxSessionBudgetCents: number | null;
  /** Maximum total cost in US cents per individual agent spawn. null = no cap. */
  readonly maxAgentBudgetCents: number | null;
  /** Allowed model identifiers. null = all models allowed. */
  readonly allowedModels: readonly string[] | null;
};

const PERMISSIVE_POLICY: AdminPolicy = {
  workspaceId: null,
  maxSessionBudgetCents: null,
  maxAgentBudgetCents: null,
  allowedModels: null,
};

// ── Policy loader ────────────────────────────────────────────────────────────

/**
 * Load the admin policy for a given workspace from Supabase.
 *
 * Returns PERMISSIVE_POLICY when:
 *   - Supabase is not configured
 *   - No admin_config row exists for the workspace
 *   - The fetch fails
 */
export async function loadAdminPolicy(workspaceId: string): Promise<AdminPolicy> {
  const sb = await getSupabaseClient();
  if (!sb || !workspaceId) return PERMISSIVE_POLICY;

  try {
    const { data, error } = await sb
      .from('admin_config')
      .select('workspace_id, max_session_budget_cents, max_agent_budget_cents, allowed_models')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      console.warn('[adminPolicy] Could not load admin_config — using permissive defaults:', error.message);
      return PERMISSIVE_POLICY;
    }

    if (!data) return PERMISSIVE_POLICY;

    return {
      workspaceId: (data.workspace_id as string | null) ?? null,
      maxSessionBudgetCents: (data.max_session_budget_cents as number | null) ?? null,
      maxAgentBudgetCents: (data.max_agent_budget_cents as number | null) ?? null,
      allowedModels: (data.allowed_models as string[] | null) ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[adminPolicy] Unexpected error loading policy — using permissive defaults:', message);
    return PERMISSIVE_POLICY;
  }
}

// ── Policy checks ────────────────────────────────────────────────────────────

/**
 * Returns true if the given model is permitted by the policy.
 * When allowedModels is null, all models are permitted.
 */
export function isModelAllowed(policy: AdminPolicy, model: string): boolean {
  if (policy.allowedModels === null) return true;
  return policy.allowedModels.includes(model);
}

/**
 * Returns true if the given cost (in US cents) would exceed the per-agent budget cap.
 * When maxAgentBudgetCents is null, there is no cap and this always returns false.
 */
export function isAgentBudgetExceeded(policy: AdminPolicy, costCents: number): boolean {
  if (policy.maxAgentBudgetCents === null) return false;
  return costCents > policy.maxAgentBudgetCents;
}

/**
 * Returns true if the given accumulated session cost (in US cents) would exceed
 * the session budget cap.
 * When maxSessionBudgetCents is null, there is no cap and this always returns false.
 */
export function isSessionBudgetExceeded(policy: AdminPolicy, totalCostCents: number): boolean {
  if (policy.maxSessionBudgetCents === null) return false;
  return totalCostCents > policy.maxSessionBudgetCents;
}

// ── Audit helper ─────────────────────────────────────────────────────────────

export async function auditPolicyViolation(
  reason: 'model_not_allowed' | 'agent_budget_exceeded' | 'session_budget_exceeded',
  context: Record<string, unknown>,
): Promise<void> {
  await audit('policy_violation', { reason, ...context });
  console.warn(`[adminPolicy] Policy violation: ${reason}`, context);
}
