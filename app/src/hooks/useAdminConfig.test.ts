/**
 * Unit tests — useAdminConfig hook
 *
 * Tests cover:
 *   - rowToConfig: pure mapping of DB row to AdminConfig shape
 *   - isOwner derivation: true only when authenticated user matches workspace owner
 *   - No-op behaviour when Supabase is not configured
 *   - updateConfig rejection when caller is not the workspace owner
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminConfig, rowToConfig } from './useAdminConfig';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(),
  supabase: null,
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: null })),
}));

vi.mock('../stores/sessionStore', () => ({
  useSessionStore: vi.fn(() => ({ workspaceId: null })),
}));

vi.mock('./useWorkspaces', () => ({
  useWorkspaces: vi.fn(() => ({ workspaces: [] })),
}));

import * as supabaseLib from '../lib/supabase';
import * as authStoreLib from '../stores/authStore';
import * as sessionStoreLib from '../stores/sessionStore';
import * as useWorkspacesLib from './useWorkspaces';

const mockIsConfigured = supabaseLib.isSupabaseConfigured as ReturnType<typeof vi.fn>;
const mockUseAuthStore = authStoreLib.useAuthStore as ReturnType<typeof vi.fn>;
const mockUseSessionStore = sessionStoreLib.useSessionStore as ReturnType<typeof vi.fn>;
const mockUseWorkspaces = useWorkspacesLib.useWorkspaces as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(false);
  mockUseAuthStore.mockReturnValue({ user: null });
  mockUseSessionStore.mockReturnValue({ workspaceId: null });
  mockUseWorkspaces.mockReturnValue({ workspaces: [] });
});

// ── rowToConfig — pure mapping ───────────────────────────────────────────────

describe('rowToConfig', () => {
  it('maps all fields from the DB row to AdminConfig', () => {
    const row = {
      id: 'cfg-1',
      workspace_id: 'ws-1',
      max_session_budget_cents: 5000,
      max_agent_budget_cents: 1000,
      allowed_models: ['claude-sonnet-4-6'],
      updated_at: '2026-03-01T00:00:00Z',
      updated_by: 'user-1',
    };

    const result = rowToConfig(row);

    expect(result).toEqual({
      id: 'cfg-1',
      workspaceId: 'ws-1',
      maxSessionBudgetCents: 5000,
      maxAgentBudgetCents: 1000,
      allowedModels: ['claude-sonnet-4-6'],
      updatedAt: '2026-03-01T00:00:00Z',
      updatedBy: 'user-1',
    });
  });

  it('maps null nullable fields to null (not undefined)', () => {
    const row = {
      id: 'cfg-2',
      workspace_id: 'ws-2',
      max_session_budget_cents: null,
      max_agent_budget_cents: null,
      allowed_models: null,
      updated_at: '2026-03-01T00:00:00Z',
      updated_by: null,
    };

    const result = rowToConfig(row);

    expect(result.maxSessionBudgetCents).toBeNull();
    expect(result.maxAgentBudgetCents).toBeNull();
    expect(result.allowedModels).toBeNull();
    expect(result.updatedBy).toBeNull();
  });
});

// ── useAdminConfig — isOwner ─────────────────────────────────────────────────

describe('useAdminConfig — isOwner', () => {
  it('isOwner is false when there is no authenticated user', () => {
    mockUseAuthStore.mockReturnValue({ user: null });
    mockUseSessionStore.mockReturnValue({ workspaceId: 'ws-1' });
    mockUseWorkspaces.mockReturnValue({
      workspaces: [{ id: 'ws-1', ownerUid: 'user-1', name: 'My WS', createdAt: '' }],
    });

    const { result } = renderHook(() => useAdminConfig());

    expect(result.current.isOwner).toBe(false);
  });

  it('isOwner is true when authenticated user owns the active workspace', () => {
    mockUseAuthStore.mockReturnValue({ user: { id: 'user-1' } });
    mockUseSessionStore.mockReturnValue({ workspaceId: 'ws-1' });
    mockUseWorkspaces.mockReturnValue({
      workspaces: [{ id: 'ws-1', ownerUid: 'user-1', name: 'My WS', createdAt: '' }],
    });

    const { result } = renderHook(() => useAdminConfig());

    expect(result.current.isOwner).toBe(true);
  });

  it('isOwner is false when authenticated user does not own the active workspace', () => {
    mockUseAuthStore.mockReturnValue({ user: { id: 'user-2' } });
    mockUseSessionStore.mockReturnValue({ workspaceId: 'ws-1' });
    mockUseWorkspaces.mockReturnValue({
      workspaces: [{ id: 'ws-1', ownerUid: 'user-1', name: 'My WS', createdAt: '' }],
    });

    const { result } = renderHook(() => useAdminConfig());

    expect(result.current.isOwner).toBe(false);
  });
});

// ── useAdminConfig — not configured ─────────────────────────────────────────

describe('useAdminConfig — Supabase not configured', () => {
  it('returns null config and loading=false when Supabase is not configured', () => {
    mockIsConfigured.mockReturnValue(false);
    mockUseSessionStore.mockReturnValue({ workspaceId: 'ws-1' });

    const { result } = renderHook(() => useAdminConfig());

    expect(result.current.config).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('updateConfig throws when Supabase is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    mockUseAuthStore.mockReturnValue({ user: { id: 'user-1' } });
    mockUseSessionStore.mockReturnValue({ workspaceId: 'ws-1' });
    mockUseWorkspaces.mockReturnValue({
      workspaces: [{ id: 'ws-1', ownerUid: 'user-1', name: 'WS', createdAt: '' }],
    });

    const { result } = renderHook(() => useAdminConfig());

    await expect(
      result.current.updateConfig({ maxSessionBudgetCents: 100, maxAgentBudgetCents: 50, allowedModels: null }),
    ).rejects.toThrow('[useAdminConfig] Supabase is not configured');
  });

  it('updateConfig throws when caller is not the workspace owner', async () => {
    mockIsConfigured.mockReturnValue(true);
    // Provide a full query chain so the useEffect fetch doesn't throw
    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: { data: null; error: null }) => void) => { resolve({ data: null, error: null }); return Promise.resolve(); }),
      catch: vi.fn().mockReturnThis(),
    };
    Object.defineProperty(supabaseLib, 'supabase', {
      value: { from: vi.fn().mockReturnValue(fetchChain) },
      configurable: true,
    });
    mockUseAuthStore.mockReturnValue({ user: { id: 'user-2' } }); // not the owner
    mockUseSessionStore.mockReturnValue({ workspaceId: 'ws-1' });
    mockUseWorkspaces.mockReturnValue({
      workspaces: [{ id: 'ws-1', ownerUid: 'user-1', name: 'WS', createdAt: '' }],
    });

    const { result } = renderHook(() => useAdminConfig());

    await expect(
      result.current.updateConfig({ maxSessionBudgetCents: null, maxAgentBudgetCents: null, allowedModels: null }),
    ).rejects.toThrow('[useAdminConfig] Only the workspace owner can update admin config');
  });
});
