/**
 * WorkspaceSwitcher — dropdown in the topbar for selecting the active workspace.
 *
 * When no workspaces exist in Supabase, shows "Personal" as the default.
 */
import { useRef, useState } from 'react';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useSessionStore } from '../../stores/sessionStore';

export function WorkspaceSwitcher() {
  const { workspaces, loading } = useWorkspaces();
  const { workspaceId, setWorkspaceId } = useSessionStore();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeWorkspace =
    workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];

  function handleSelect(id: string) {
    setWorkspaceId(id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch workspace"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 4,
          fontSize: 'var(--font-xxs)',
          color: 'var(--text-1)',
          border: '1px solid var(--border-1)',
          background: 'var(--bg-2)',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          minWidth: 80,
          maxWidth: 140,
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontSize: 9, color: 'var(--text-3)' }}
        >
          ◫
        </span>
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, textAlign: 'left',
        }}>
          {loading ? '…' : (activeWorkspace?.name ?? 'Personal')}
        </span>
        <span aria-hidden="true" style={{ fontSize: 8, color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : undefined, display: 'inline-block', transition: 'transform 0.15s' }}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Workspaces"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 200,
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minWidth: 160,
            maxWidth: 220,
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
          }}
        >
          {workspaces.map((ws) => {
            const isActive = ws.id === (activeWorkspace?.id);
            return (
              <li
                key={ws.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(ws.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(ws.id);
                  }
                }}
                tabIndex={0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  fontSize: 'var(--font-xs)',
                  color: isActive ? 'var(--cyan)' : 'var(--text-1)',
                  background: isActive ? 'var(--cyan)11' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {isActive && (
                  <span aria-hidden="true" style={{ color: 'var(--cyan)', fontSize: 10, flexShrink: 0 }}>✓</span>
                )}
                {!isActive && <span style={{ width: 14, flexShrink: 0 }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ws.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
