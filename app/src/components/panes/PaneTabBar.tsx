import { useSessionStore } from '../../stores/sessionStore';
import type { PaneTab } from '../../types';

const TABS: { id: PaneTab; label: string; icon: string }[] = [
  { id: 'agents',    label: 'Agents',    icon: '◈' },
  { id: 'kanban',    label: 'Kanban',    icon: '⊞' },
  { id: 'costs',     label: 'Costs',     icon: '◎' },
  { id: 'approvals', label: 'Approvals', icon: '◉' },
];

interface Props {
  paneId: string;
  pendingApprovals?: number;
}

export function PaneTabBar({ paneId, pendingApprovals = 0 }: Props) {
  const { panes, setPaneTab } = useSessionStore();
  const pane = panes.find((p) => p.id === paneId);
  if (!pane) return null;

  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--border-0)',
      background: 'var(--bg-1)', flexShrink: 0,
    }}>
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
  );
}
