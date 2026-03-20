import { useMemo } from 'react';
import { PaneTabBar } from './PaneTabBar';
import { PaneProjectSelector } from './PaneProjectSelector';
import { AgentView } from '../agents/AgentView';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { DagView } from '../dag/DagView';
import { SessionReplay } from '../replay/SessionReplay';
import { CostDashboard } from '../cost/CostDashboard';
import { ApprovalQueue } from '../permissions/ApprovalQueue';
import { VPSManager } from '../vps/VPSManager';
import { useSessionStore } from '../../stores/sessionStore';
import { useKanbanStore } from '../../stores/kanbanStore';
import { useAgentStore } from '../../stores/agentStore';
import { useCostStore } from '../../stores/costStore';
import type { SessionEvent } from '../../types';

interface Props {
  paneId: string;
}

export function PaneContainer({ paneId }: Props) {
  const panes = useSessionStore((s) => s.panes);
  const sessions = useSessionStore((s) => s.sessions);
  const setActivePane = useSessionStore((s) => s.setActivePane);
  const setPaneTab = useSessionStore((s) => s.setPaneTab);
  const pane = useMemo(() => panes.find((p) => p.id === paneId), [panes, paneId]);
  const session = useMemo(() => sessions.find((s) => s.id === pane?.sessionId), [sessions, pane?.sessionId]);
  const tasks = useKanbanStore((s) => s.tasks);

  // Subscribe to raw primitives only — selectors that return computed arrays (filter/map)
  // create new references on every call, breaking useSyncExternalStore's getSnapshot
  // caching requirement and causing React error #185.
  const rawEvents = useAgentStore((s) => s.events);
  const eventFilter = useAgentStore((s) => s.eventFilter);
  const rawRecords = useCostStore((s) => s.records);

  const agentEvents = useMemo(
    () => !session
      ? []
      : rawEvents
          .filter((e) => e.sessionId === session.id)
          .filter((e) => !eventFilter || e.agentId === eventFilter),
    [rawEvents, eventFilter, session],
  );

  const sessionCostUsd = useMemo(
    () => !session
      ? 0
      : rawRecords
          .filter((r) => r.sessionId === session.id)
          .reduce((sum, r) => sum + r.costUsd, 0),
    [rawRecords, session],
  );

  function renderContent() {
    // VPS/Infrastructure tab is always accessible regardless of session state
    if (pane?.activeTab === 'vps') {
      return <VPSManager />;
    }

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
      <PaneTabBar paneId={paneId} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}
