/**
 * Unit tests — useWorkspaces hook
 *
 * Tests cover:
 *   - Fallback to PERSONAL_WORKSPACE when Supabase is not configured
 *   - Fallback when the fetch returns an error
 *   - Correct row → Workspace mapping
 *   - Fallback when data is empty
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspaces, PERSONAL_WORKSPACE } from './useWorkspaces';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(),
  supabase: null,
}));

import * as supabaseLib from '../lib/supabase';

const mockIsConfigured = supabaseLib.isSupabaseConfigured as ReturnType<typeof vi.fn>;

// Helper: build a fluent Supabase query chain mock
function makeQueryChain(resolveValue: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: typeof resolveValue) => void) => {
      resolve(resolveValue);
      return Promise.resolve();
    }),
    catch: vi.fn().mockReturnThis(),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useWorkspaces — Supabase not configured', () => {
  it('returns PERSONAL_WORKSPACE immediately and does not attempt a fetch', () => {
    mockIsConfigured.mockReturnValue(false);

    const { result } = renderHook(() => useWorkspaces());

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0]).toEqual(PERSONAL_WORKSPACE);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('useWorkspaces — Supabase configured', () => {
  beforeEach(() => {
    mockIsConfigured.mockReturnValue(true);
  });

  it('maps fetched rows to Workspace objects', async () => {
    const rows = [
      { id: 'ws-1', name: 'My Workspace', owner_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
    ];
    const queryChain = makeQueryChain({ data: rows, error: null });
    Object.defineProperty(supabaseLib, 'supabase', {
      value: { from: vi.fn().mockReturnValue(queryChain) },
      configurable: true,
    });

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0]).toEqual({
      id: 'ws-1',
      name: 'My Workspace',
      ownerUid: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(result.current.error).toBeNull();
  });

  it('falls back to PERSONAL_WORKSPACE when fetch returns an error', async () => {
    const queryChain = makeQueryChain({ data: null, error: { message: 'table not found' } });
    Object.defineProperty(supabaseLib, 'supabase', {
      value: { from: vi.fn().mockReturnValue(queryChain) },
      configurable: true,
    });

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0]).toEqual(PERSONAL_WORKSPACE);
    // Errors from Supabase are not surfaced to the user (pre-migration expected case)
    expect(result.current.error).toBeNull();
  });

  it('falls back to PERSONAL_WORKSPACE when data is empty', async () => {
    const queryChain = makeQueryChain({ data: [], error: null });
    Object.defineProperty(supabaseLib, 'supabase', {
      value: { from: vi.fn().mockReturnValue(queryChain) },
      configurable: true,
    });

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0]).toEqual(PERSONAL_WORKSPACE);
  });

  it('handles null owner_id gracefully (ownerUid defaults to empty string)', async () => {
    const rows = [
      { id: 'ws-2', name: 'Team', owner_id: null, created_at: '2026-02-01T00:00:00Z' },
    ];
    const queryChain = makeQueryChain({ data: rows, error: null });
    Object.defineProperty(supabaseLib, 'supabase', {
      value: { from: vi.fn().mockReturnValue(queryChain) },
      configurable: true,
    });

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workspaces[0].ownerUid).toBe('');
  });
});
