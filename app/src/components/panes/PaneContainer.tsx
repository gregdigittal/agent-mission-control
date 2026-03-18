import { PaneTabBar } from './PaneTabBar';
import { PaneProjectSelector } from './PaneProjectSelector';
import { AgentView } from '../agents/AgentView';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { DagView } from '../dag/DagView';
import { SessionReplay } from '../replay/SessionReplay';
import { CostDashboard } from '../cost/CostDashboard';
import { ApprovalQueue } from '../permissions/ApprovalQueue';
import { useSessionStore } from '../../stores/sessionStore';
import { useKanbanStore } from '../../stores/kanbanStore';
import { useAgentStore } from '../../stores/agentStore';
import { useCostStore } from '../../stores/costStore';
import type { SessionEvent } from '../../types';

interface Props {
  paneId: string;
}

export function PaneContainer({ paneId }: Props) {
  const { panes, sessions, setActivePane, setPaneTab } = useSessionStore();
  const pane = panes.find((p) => p.id === paneId);
  const session = sessions.find((s) => s.id === pane?.sessionId);
  const tasks = useKanbanStore((s) => s.tasks);
  const agentEvents = useAgentStore((s) => session ? s.eventsBySession(session.id) : []);
  const sessionCostUsd = useCostStore((s) => session ? s.totalBySession(session.id) : 0);

  function renderContent() {
    if (!pane?.sessionId || !session) {
      return <PaneProjectSelector paneId={paneId} />;
    }

    const sessionTasks = tasks.filter((t) => t.sessionId === session.id);

    switch (pane.activeTab) {
      case 'agents':    return <AgentView sessionId={session.id} />;
      case 'kanban':    return <KanbanBoard sessionId={session.id} />;
      case 'dag':       return (
        <DagView
          tasks={sessionTasks}
          onTaskSelect={(id) => {
            // Switch to kanban tab so user can act on the selected task
            setPaneTab(paneId, 'kanban');
            void id; // task selection forwarded via tab switch; detail panel is future work
          }}
        />
      );
      case 'replay':    return (
        <SessionReplay
          sessionId={session.id}
          events={agentEvents as SessionEvent[]}
          costCents={sessionCostUsd * 100}
        />
      );
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
      {pane?.sessionId && session && <PaneTabBar paneId={paneId} />}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}
