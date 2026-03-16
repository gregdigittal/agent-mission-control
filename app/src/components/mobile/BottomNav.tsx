import { useSessionStore } from '../../stores/sessionStore';
import type { PaneTab } from '../../types';

const TABS: { id: PaneTab; label: string; icon: string }[] = [
  { id: 'agents',    label: 'Agents',    icon: '◈' },
  { id: 'kanban',    label: 'Kanban',    icon: '⊞' },
  { id: 'costs',     label: 'Costs',     icon: '◎' },
  { id: 'approvals', label: 'Approvals', icon: '◉' },
];

interface Props {
  pendingApprovals?: number;
}

export function BottomNav({ pendingApprovals = 0 }: Props) {
  const { panes, activePane, setPaneTab, screenProfile } = useSessionStore();
  if (screenProfile !== 'mobile') return null;

  const pane = panes.find((p) => p.id === activePane) ?? panes[0];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'var(--bottomnav-h)',
      display: 'flex', background: 'var(--bg-1)',
      borderTop: '1px solid var(--border-0)',
      zIndex: 200,
    }}>
      {TABS.map(({ id, label, icon }) => {
        const active = pane?.activeTab === id;
        const badge = id === 'approvals' && pendingApprovals > 0;
        return (
          <button
            key={id}
            onClick={() => pane && setPaneTab(pane.id, id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              color: active ? 'var(--cyan)' : 'var(--text-3)',
              minHeight: 'var(--tap-target)',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 'var(--font-xxs)', letterSpacing: '0.3px' }}>{label}</span>
            {badge && (
              <span style={{
                position: 'absolute', top: 8, right: '50%', marginRight: -14,
                background: 'var(--amber)', borderRadius: '50%',
                width: 8, height: 8,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
