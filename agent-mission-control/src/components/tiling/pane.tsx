"use client";

import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";
import type { PaneView, Session } from "@/lib/types";
import { AgentView } from "@/components/agent-view";
import { KanbanBoard } from "@/components/kanban";
import { RestartSessionModal } from "@/components/top-bar/restart-session-modal";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface PaneProps {
  index: number;
}

export function Pane({ index }: PaneProps) {
  const pane = useUIStore((s) => s.panes[index]);
  const sessions = useUIStore((s) => s.sessions);
  const order = useUIStore((s) => s.order);
  const staleSessions = useUIStore((s) => s.staleSessions);
  const staleOrder = useUIStore((s) => s.staleOrder);
  const setPaneSession = useUIStore((s) => s.setPaneSession);
  const setPaneView = useUIStore((s) => s.setPaneView);
  const [restartTarget, setRestartTarget] = useState<Session | null>(null);

  if (!pane) return null;

  const isStale = pane.sid in staleSessions && !(pane.sid in sessions);
  const session = sessions[pane.sid] ?? staleSessions[pane.sid];

  return (
    <>
      <div className="flex-1 min-w-[var(--pane-min)] flex flex-col border-r border-border-1 last:border-r-0 overflow-hidden">
        {/* Pane header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-1 border-b border-border-1">
          <select
            value={pane.sid}
            onChange={(e) => setPaneSession(index, e.target.value)}
            className="bg-bg-2 text-text-2 text-xs font-mono border border-border-2 rounded px-2 py-1 cursor-pointer focus:border-cyan focus:outline-none"
          >
            {order.map((sid) => (
              <option key={sid} value={sid}>
                {sessions[sid]?.project || sid}
              </option>
            ))}
            {staleOrder.length > 0 && (
              <optgroup label="Stale">
                {staleOrder.map((sid) => (
                  <option key={sid} value={sid}>
                    {staleSessions[sid]?.project || sid}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <select
            value={pane.view}
            onChange={(e) => setPaneView(index, e.target.value as PaneView)}
            className="bg-bg-2 text-text-2 text-xs font-mono border border-border-2 rounded px-2 py-1 cursor-pointer focus:border-cyan focus:outline-none"
          >
            <option value="agents">Agent View</option>
            <option value="kanban">Kanban Board</option>
          </select>
        </div>

        {/* Inactive banner for stale sessions */}
        {isStale && session && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber/10 border-b border-amber/30">
            <span className="text-amber text-xs">⏱</span>
            <span className="text-amber text-xs font-mono flex-1">
              Session inactive since{" "}
              {session.updated_at ? relativeTime(session.updated_at) : "unknown"}
            </span>
            <button
              onClick={() => setRestartTarget(session)}
              className="px-2 py-0.5 text-xxs font-mono text-amber hover:bg-amber/10 rounded cursor-pointer"
            >
              Restart
            </button>
          </div>
        )}

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

      {restartTarget && (
        <RestartSessionModal
          session={restartTarget}
          onClose={() => setRestartTarget(null)}
        />
      )}
    </>
  );
}
