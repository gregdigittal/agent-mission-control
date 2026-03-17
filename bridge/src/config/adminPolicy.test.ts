/**
 * Unit tests — bridge: admin policy enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../supabase/client.js', () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  loadAdminPolicy,
  isModelAllowed,
  isAgentBudgetExceeded,
  isSessionBudgetExceeded,
} from './adminPolicy.js';
import { getSupabaseClient } from '../supabase/client.js';

const mockGetClient = getSupabaseClient as ReturnType<typeof vi.fn>;

// Helper: build a mock Supabase query chain
function makeQueryChain(resolveValue: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolveValue),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── loadAdminPolicy ──────────────────────────────────────────────────────────

describe('loadAdminPolicy', () => {
  it('returns permissive policy when Supabase client is null', async () => {
    mockGetClient.mockResolvedValue(null);

    const policy = await loadAdminPolicy('ws-1');

    expect(policy.maxSessionBudgetCents).toBeNull();
    expect(policy.maxAgentBudgetCents).toBeNull();
    expect(policy.allowedModels).toBeNull();
  });

  it('returns permissive policy when workspaceId is empty', async () => {
    mockGetClient.mockResolvedValue({});

    const policy = await loadAdminPolicy('');

    expect(policy.maxSessionBudgetCents).toBeNull();
    expect(policy.allowedModels).toBeNull();
  });

  it('returns permissive policy when no row exists', async () => {
    const chain = makeQueryChain({ data: null, error: null });
    mockGetClient.mockResolvedValue(chain);

    const policy = await loadAdminPolicy('ws-1');

    expect(policy.maxSessionBudgetCents).toBeNull();
    expect(policy.allowedModels).toBeNull();
  });

  it('returns permissive policy when Supabase returns an error', async () => {
    const chain = makeQueryChain({ data: null, error: { message: 'permission denied' } });
    mockGetClient.mockResolvedValue(chain);

    const policy = await loadAdminPolicy('ws-1');

    expect(policy.allowedModels).toBeNull();
  });

  it('maps the admin_config row to AdminPolicy correctly', async () => {
    const row = {
      workspace_id: 'ws-1',
      max_session_budget_cents: 5000,
      max_agent_budget_cents: 1000,
      allowed_models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    };
    const chain = makeQueryChain({ data: row, error: null });
    mockGetClient.mockResolvedValue(chain);

    const policy = await loadAdminPolicy('ws-1');

    expect(policy.workspaceId).toBe('ws-1');
    expect(policy.maxSessionBudgetCents).toBe(5000);
    expect(policy.maxAgentBudgetCents).toBe(1000);
    expect(policy.allowedModels).toEqual(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']);
  });

  it('handles null nullable fields in the row', async () => {
    const row = {
      workspace_id: 'ws-2',
      max_session_budget_cents: null,
      max_agent_budget_cents: null,
      allowed_models: null,
    };
    const chain = makeQueryChain({ data: row, error: null });
    mockGetClient.mockResolvedValue(chain);

    const policy = await loadAdminPolicy('ws-2');

    expect(policy.maxSessionBudgetCents).toBeNull();
    expect(policy.maxAgentBudgetCents).toBeNull();
    expect(policy.allowedModels).toBeNull();
  });
});

// ── isModelAllowed ───────────────────────────────────────────────────────────

describe('isModelAllowed', () => {
  const permissive = { workspaceId: null, maxSessionBudgetCents: null, maxAgentBudgetCents: null, allowedModels: null };

  it('returns true when allowedModels is null (no restriction)', () => {
    expect(isModelAllowed(permissive, 'any-model')).toBe(true);
  });

  it('returns true when the model is in the allowedModels list', () => {
    const policy = { ...permissive, allowedModels: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] };
    expect(isModelAllowed(policy, 'claude-sonnet-4-6')).toBe(true);
  });

  it('returns false when the model is NOT in the allowedModels list', () => {
    const policy = { ...permissive, allowedModels: ['claude-haiku-4-5-20251001'] };
    expect(isModelAllowed(policy, 'claude-opus-4-6')).toBe(false);
  });
});

// ── isAgentBudgetExceeded ────────────────────────────────────────────────────

describe('isAgentBudgetExceeded', () => {
  const permissive = { workspaceId: null, maxSessionBudgetCents: null, maxAgentBudgetCents: null, allowedModels: null };

  it('returns false when maxAgentBudgetCents is null', () => {
    expect(isAgentBudgetExceeded(permissive, 999999)).toBe(false);
  });

  it('returns false when cost is below the cap', () => {
    const policy = { ...permissive, maxAgentBudgetCents: 1000 };
    expect(isAgentBudgetExceeded(policy, 500)).toBe(false);
  });

  it('returns true when cost exceeds the cap', () => {
    const policy = { ...permissive, maxAgentBudgetCents: 1000 };
    expect(isAgentBudgetExceeded(policy, 1001)).toBe(true);
  });

  it('returns false when cost exactly equals the cap', () => {
    const policy = { ...permissive, maxAgentBudgetCents: 1000 };
    expect(isAgentBudgetExceeded(policy, 1000)).toBe(false);
  });
});

// ── isSessionBudgetExceeded ──────────────────────────────────────────────────

describe('isSessionBudgetExceeded', () => {
  const permissive = { workspaceId: null, maxSessionBudgetCents: null, maxAgentBudgetCents: null, allowedModels: null };

  it('returns false when maxSessionBudgetCents is null', () => {
    expect(isSessionBudgetExceeded(permissive, 999999)).toBe(false);
  });

  it('returns false when total is below the cap', () => {
    const policy = { ...permissive, maxSessionBudgetCents: 5000 };
    expect(isSessionBudgetExceeded(policy, 4999)).toBe(false);
  });

  it('returns true when total exceeds the cap', () => {
    const policy = { ...permissive, maxSessionBudgetCents: 5000 };
    expect(isSessionBudgetExceeded(policy, 5001)).toBe(true);
  });
});
