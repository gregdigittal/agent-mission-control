import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useProjectStore } from '../../stores/projectStore';
import type { PaneTab } from '../../types';

const TABS: { id: PaneTab; label: string; icon: string }[] = [
  { id: 'agents',    label: 'Agents',         icon: '◈' },
  { id: 'kanban',    label: 'Kanban',         icon: '⊞' },
  { id: 'dag',       label: 'Task Graph',     icon: '⬡' },
  { id: 'replay',    label: 'Session Replay', icon: '⏵' },
  { id: 'costs',     label: 'Costs',          icon: '◎' },
  { id: 'approvals', label: 'Approvals',      icon: '◉' },
  { id: 'vps',       label: 'Infrastructure', icon: '⬡' },
];

interface Props {
  paneId: string;
  pendingApprovals?: number;
}

export function PaneTabBar({ paneId, pendingApprovals = 0 }: Props) {
  const { panes, sessions, setPaneTab, setPaneSession, setPaneProject } = useSessionStore();
  const { projects } = useProjectStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside — must be before any conditional return
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const pane = panes.find((p) => p.id === paneId);
  if (!pane) return null;

  const activeSession = sessions.find((s) => s.id === pane.sessionId);
  const activeProject = projects.find((p) => p.id === pane.projectId);

  // Sessions for the current project (for the switcher dropdown)
  const projectSessions = sessions.filter((s) => s.projectId === pane.projectId);

  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--border-0)',
      background: 'var(--bg-1)', flexShrink: 0, alignItems: 'center',
    }}>
      {/* Tab buttons */}
      <div style={{ display: 'flex', flex: 1 }}>
        {TABS.map(({ id, label, icon }) => {
          const active = pane.activeTab === id;
          const badge = id === 'approvals' && pendingApprovals > 0;
          return (
            <button
              key={id}
              onClick={() => setPaneTab(paneId, id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', fontSize: 'var(--font-xs)',
                color: active ? 'var(--cyan)' : 'var(--text-2)',
                borderBottom: `2px solid ${active ? 'var(--cyan)' : 'transparent'}`,
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 10 }}>{icon}</span>
              {label}
              {badge && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Project / session switcher */}
      {activeProject && (
        <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, marginRight: 8 }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 8px', borderRadius: 4,
              fontSize: 'var(--font-xs)', color: 'var(--text-2)',
              background: dropdownOpen ? 'var(--bg-3)' : 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!dropdownOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)';
            }}
            onMouseLeave={(e) => {
              if (!dropdownOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
            title="Switch session or project"
          >
            {activeSession && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: `var(--${activeSession.color})`,
              }} />
            )}
            <span style={{ color: 'var(--text-3)' }}>{activeProject.name}</span>
            {activeSession && (
              <>
                <span style={{ color: 'var(--border-1)' }}>/</span>
                <span style={{ color: 'var(--text-2)' }}>{activeSession.name}</span>
              </>
            )}
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>▾</span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 200,
              background: 'var(--bg-2)', border: '1px solid var(--border-0)',
              borderRadius: 6, minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}>
              {/* Session list for this project */}
              {projectSessions.length > 0 && (
                <>
                  <div style={{
                    padding: '6px 10px 4px',
                    fontSize: 'var(--font-xxs)', color: 'var(--text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Sessions
                  </div>
                  {projectSessions.map((session) => {
                    const isActive = session.id === pane.sessionId;
                    return (
                      <button
                        key={session.id}
                        onClick={() => {
                          setPaneSession(paneId, session.id);
                          setDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '7px 10px',
                          fontSize: 'var(--font-xs)',
                          color: isActive ? 'var(--cyan)' : 'var(--text-1)',
                          background: isActive ? 'var(--bg-3)' : 'transparent',
                          textAlign: 'left', cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: `var(--${session.color})`,
                        }} />
                        {session.name}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border-0)', margin: '4px 0' }} />

              {/* Change project */}
              <button
                onClick={() => {
                  setPaneProject(paneId, '');
                  setDropdownOpen(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '7px 10px',
                  fontSize: 'var(--font-xs)', color: 'var(--text-3)',
                  textAlign: 'left', cursor: 'pointer',
                }}
              >
                <span aria-hidden="true">←</span>
                Change project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
