"use client";

import { useUIStore } from "@/stores/ui-store";
import type { Task, Agent } from "@/lib/types";

interface KanbanCardProps {
  task: Task;
  sessionId: string;
  activeAgent?: Agent;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red",
  medium: "bg-amber",
  low: "bg-green",
};

export function KanbanCard({ task, sessionId, activeAgent }: KanbanCardProps) {
  const approveTask = useUIStore((s) => s.approveTask);
  const rejectTask = useUIStore((s) => s.rejectTask);

  const isRec = task.rec && !task._auto;
  const isTrans = task.rec && task._auto;
  const isDep = !!task.depOf;
  const isAgentActive = !!activeAgent;

  let borderClass = "border-border-1";
  if (isRec) borderClass = "border-violet shadow-[0_0_12px_rgba(167,139,250,.15)]";
  else if (isTrans) borderClass = "border-blue shadow-[0_0_12px_rgba(96,165,250,.15)]";
  else if (isDep) borderClass = "border-amber";
  if (isAgentActive) borderClass += " border-l-2 border-l-cyan";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`bg-bg-3 rounded-md p-[var(--card-pad,12px)] border cursor-grab hover:-translate-y-px hover:border-border-2 transition-all select-none ${borderClass}`}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} />
        <span className="text-xs text-text-1 font-mono leading-tight">{task.title}</span>
      </div>

      {/* Assignee */}
      <div className="text-xxs text-text-3 mb-1">{task.assignee}</div>

      {/* Active agent indicator */}
      {isAgentActive && activeAgent && (
        <div className="flex items-center gap-1 text-xxs text-cyan mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse-dot" />
          <span className="font-mono">{activeAgent.name}</span>
        </div>
      )}

      {/* Recommendation badge */}
      {isRec && (
        <div className="mt-2 p-2 rounded bg-violet/10 border border-violet/30">
          <div className="text-xxs text-violet font-mono mb-1">PERMISSION REQUEST</div>
          <div className="text-xxs text-text-2 mb-2">{task.recWhy}</div>
          <div className="flex gap-2">
            <button
              onClick={() => approveTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-green/20 text-green border border-green/30 hover:bg-green/30 cursor-pointer"
            >
              Allow
            </button>
            <button
              onClick={() => rejectTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-red/20 text-red border border-red/30 hover:bg-red/30 cursor-pointer"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Transition badge */}
      {isTrans && (
        <div className="mt-2 p-2 rounded bg-blue/10 border border-blue/30">
          <div className="text-xxs text-blue font-mono mb-1">STATUS CHANGE</div>
          <div className="text-xxs text-text-2 mb-2">{task.recWhy}</div>
          <div className="flex gap-2">
            <button
              onClick={() => approveTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-green/20 text-green border border-green/30 hover:bg-green/30 cursor-pointer"
            >
              Confirm
            </button>
            <button
              onClick={() => rejectTask(sessionId, task.id)}
              className="px-2 py-0.5 rounded text-xxs font-mono bg-amber/20 text-amber border border-amber/30 hover:bg-amber/30 cursor-pointer"
            >
              Revert
            </button>
          </div>
        </div>
      )}

      {/* Dependency badge */}
      {isDep && !isRec && !isTrans && (
        <div className="mt-2 p-1.5 rounded bg-amber/10 border border-amber/30">
          <div className="text-xxs text-amber font-mono">
            DEP: Required by {task.depOf}
          </div>
        </div>
      )}
    </div>
  );
}
