"use client";

import { useUIStore } from "@/stores/ui-store";
import type { PaneView } from "@/lib/types";
import { AgentView } from "@/components/agent-view";
import { KanbanBoard } from "@/components/kanban";

interface PaneProps {
  index: number;
}

export function Pane({ index }: PaneProps) {
  const pane = useUIStore((s) => s.panes[index]);
  const sessions = useUIStore((s) => s.sessions);
  const order = useUIStore((s) => s.order);
  const setPaneSession = useUIStore((s) => s.setPaneSession);
  const setPaneView = useUIStore((s) => s.setPaneView);

  if (!pane) return null;
  const session = sessions[pane.sid];

  return (
    <div className="flex-1 min-w-[var(--pane-min)] flex flex-col border-r border-border-1 last:border-r-0 overflow-hidden">
      {/* Pane header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-1 border-b border-border-1">
        <select
          value={pane.sid}
          onChange={(e) => setPaneSession(index, e.target.value)}
          className="bg-bg-2 text-text-2 text-xs font-mono border border-border-2 rounded px-2 py-1 cursor-pointer"
        >
          {order.map((sid) => (
            <option key={sid} value={sid}>
              {sessions[sid]?.project || sid}
            </option>
          ))}
        </select>
        <select
          value={pane.view}
          onChange={(e) => setPaneView(index, e.target.value as PaneView)}
          className="bg-bg-2 text-text-2 text-xs font-mono border border-border-2 rounded px-2 py-1 cursor-pointer"
        >
          <option value="agents">Agent View</option>
          <option value="kanban">Kanban Board</option>
        </select>
      </div>

      {/* Pane body */}
      <div className="flex-1 overflow-y-auto p-[var(--density-pad)]">
        {session ? (
          pane.view === "agents" ? (
            <AgentView session={session} />
          ) : (
            <KanbanBoard session={session} />
          )
        ) : (
          <div className="text-text-4 text-sm text-center mt-8">
            No session selected
          </div>
        )}
      </div>
    </div>
  );
}
