import { PaneTabBar } from './PaneTabBar';
import { AgentView } from '../agents/AgentView';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { CostDashboard } from '../cost/CostDashboard';
import { ApprovalQueue } from '../permissions/ApprovalQueue';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  paneId: string;
}

export function PaneContainer({ paneId }: Props) {
  const { panes, sessions, setActivePane } = useSessionStore();
  const pane = panes.find((p) => p.id === paneId);
  const session = sessions.find((s) => s.id === pane?.sessionId);

  function renderContent() {
    if (!pane?.sessionId || !session) {
      return (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)', gap: 8,
        }}>
          <div style={{ fontSize: 24 }}>◈</div>
          <div style={{ fontSize: 'var(--font-xs)' }}>No session selected</div>
        </div>
      );
    }

    switch (pane.activeTab) {
      case 'agents':    return <AgentView sessionId={session.id} />;
      case 'kanban':    return <KanbanBoard sessionId={session.id} />;
      case 'costs':     return <CostDashboard sessionId={session.id} />;
      case 'approvals': return <ApprovalQueue sessionId={session.id} />;
    }
  }

  return (
    <div
      onClick={() => setActivePane(paneId)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-1)', border: '1px solid var(--border-0)',
        overflow: 'hidden', minWidth: 'var(--pane-min)',
      }}
    >
      {pane?.sessionId && <PaneTabBar paneId={paneId} />}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}
