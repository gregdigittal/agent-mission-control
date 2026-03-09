import type { Session } from "@/lib/types";
import { KANBAN_COLUMNS } from "@/lib/constants";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
  session: Session;
}

export function KanbanBoard({ session }: KanbanBoardProps) {
  const s = session.state;

  return (
    <div className="flex gap-[var(--density-gap)] overflow-x-auto pb-2 h-full">
      {KANBAN_COLUMNS.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={s.tasks.filter((t) => t.status === status)}
          sessionId={session.id}
          agents={s.agents}
        />
      ))}
    </div>
  );
}
