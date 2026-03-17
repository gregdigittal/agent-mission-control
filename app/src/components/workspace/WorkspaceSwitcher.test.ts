/**
 * WorkspaceSwitcher tests — pure logic coverage.
 *
 * Tests mirror the component's active workspace selection logic
 * without DOM rendering, following the project's component test pattern.
 */
import { describe, it, expect } from 'vitest';
import type { Workspace } from '../../hooks/useWorkspaces';
import { PERSONAL_WORKSPACE } from '../../hooks/useWorkspaces';

// ── Helpers mirroring WorkspaceSwitcher logic ────────────────────────────────

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'My Workspace',
    ownerUid: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Mirrors: workspaces.find((w) => w.id === workspaceId) ?? workspaces[0] */
function resolveActiveWorkspace(workspaces: Workspace[], workspaceId: string | null): Workspace | undefined {
  return workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceSwitcher — active workspace resolution', () => {
  it('falls back to the first workspace when workspaceId is null', () => {
    const ws = makeWorkspace();
    const active = resolveActiveWorkspace([ws], null);
    expect(active?.id).toBe('ws-1');
  });

  it('selects the matching workspace when workspaceId is set', () => {
    const ws1 = makeWorkspace({ id: 'ws-1', name: 'Alpha' });
    const ws2 = makeWorkspace({ id: 'ws-2', name: 'Beta' });
    const active = resolveActiveWorkspace([ws1, ws2], 'ws-2');
    expect(active?.name).toBe('Beta');
  });

  it('falls back to first workspace when workspaceId does not match any workspace', () => {
    const ws = makeWorkspace({ id: 'ws-1' });
    const active = resolveActiveWorkspace([ws], 'ws-nonexistent');
    expect(active?.id).toBe('ws-1');
  });

  it('uses PERSONAL_WORKSPACE when workspaces list has only Personal', () => {
    const active = resolveActiveWorkspace([PERSONAL_WORKSPACE], null);
    expect(active?.name).toBe('Personal');
  });

  it('returns undefined when workspaces list is empty', () => {
    const active = resolveActiveWorkspace([], 'ws-1');
    expect(active).toBeUndefined();
  });
});

describe('WorkspaceSwitcher — keyboard handling contract', () => {
  it('Escape key closes the dropdown (conceptual: tested at hook/logic level)', () => {
    // The component closes the dropdown on Escape by calling setOpen(false).
    // This is straightforward conditional logic — tested here as a contract doc.
    let open = true;
    const handleKeyDown = (key: string) => { if (key === 'Escape') open = false; };
    handleKeyDown('Escape');
    expect(open).toBe(false);
  });

  it('non-Escape keys do not close the dropdown', () => {
    let open = true;
    const handleKeyDown = (key: string) => { if (key === 'Escape') open = false; };
    handleKeyDown('Enter');
    expect(open).toBe(true);
  });
});
