import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import type { PaneTab } from '../../types';

const TABS: { id: PaneTab; labelKey: string; icon: string }[] = [
  { id: 'agents',    labelKey: 'nav.agents',    icon: '\u25c8' },
  { id: 'kanban',    labelKey: 'nav.kanban',    icon: '\u229e' },
  { id: 'costs',     labelKey: 'nav.costs',     icon: '\u25ce' },
  { id: 'approvals', labelKey: 'nav.approvals', icon: '\u25c9' },
];

interface Props {
  pendingApprovals?: number;
}

export function BottomNav({ pendingApprovals = 0 }: Props) {
  const { t } = useTranslation();
  const panes = useSessionStore((s) => s.panes);
  const activePane = useSessionStore((s) => s.activePane);
  const setPaneTab = useSessionStore((s) => s.setPaneTab);
  const screenProfile = useSessionStore((s) => s.screenProfile);
  const pane = useMemo(() => panes.find((p) => p.id === activePane) ?? panes[0], [panes, activePane]);

  if (screenProfile !== 'mobile') return null;

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'var(--bottomnav-h)',
      display: 'flex', background: 'var(--bg-1)',
      borderTop: '1px solid var(--border-0)',
      zIndex: 200,
    }}>
      {TABS.map(({ id, labelKey, icon }) => {
        const active = pane?.activeTab === id;
        const badge = id === 'approvals' && pendingApprovals > 0;
        const label = t(labelKey);
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            aria-label={badge ? t('nav.approvalsWithCount', { count: pendingApprovals }) : label}
            onClick={() => pane && setPaneTab(pane.id, id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              color: active ? 'var(--cyan)' : 'var(--text-3)',
              minHeight: 'var(--tap-target)',
              position: 'relative',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 'var(--font-xxs)', letterSpacing: '0.3px' }}>{label}</span>
            {badge && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 8, right: '50%', marginRight: -14,
                  background: 'var(--amber)', borderRadius: '50%',
                  width: 8, height: 8,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
