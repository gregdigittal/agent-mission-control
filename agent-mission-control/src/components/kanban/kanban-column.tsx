"use client";

import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";
import { COLUMN_LABELS } from "@/lib/constants";
import { KanbanCard } from "./kanban-card";
import type { Task, TaskStatus, Agent } from "@/lib/types";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  sessionId: string;
  agents: Agent[];
}

export function KanbanColumn({ status, tasks, sessionId, agents }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const moveTask = useUIStore((s) => s.moveTask);

  const agentByTask = new Map<string, Agent>();
  agents.forEach((a) => {
    if (a.taskId) agentByTask.set(a.taskId, a);
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      moveTask(sessionId, taskId, status);
    }
  }

  return (
    <div
      className={`flex-shrink-0 w-[var(--kb-col-w,280px)] flex flex-col rounded-lg border transition-all ${
        dragOver
          ? "border-cyan/50 bg-cyan/5 glow-cyan"
          : "border-border-1 bg-bg-2"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-[var(--card-pad,12px)] py-2.5 border-b border-border-1">
        <span className="text-xxs font-mono text-text-3 tracking-wider font-semibold">
          {COLUMN_LABELS[status]}
        </span>
        <span className="text-xxs font-mono text-text-4 bg-bg-3 px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 p-2 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            sessionId={sessionId}
            activeAgent={agentByTask.get(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
