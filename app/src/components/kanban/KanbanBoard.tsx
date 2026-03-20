import { useMemo } from 'react';
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { useKanbanStore } from '../../stores/kanbanStore';
import { useRealtimeKanban } from '../../hooks/useRealtimeKanban';
import type { KanbanStatus } from '../../types';

const COLUMNS: KanbanStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

interface Props {
  sessionId: string;
}

export function KanbanBoard({ sessionId }: Props) {
  useRealtimeKanban(sessionId);

  const tasks = useKanbanStore((s) => s.tasks);
  const moveTask = useKanbanStore((s) => s.moveTask);
  const setDragging = useKanbanStore((s) => s.setDragging);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // Pre-compute per-column task lists — tasksByStatus() returns a new array reference
  // every call, which breaks useSyncExternalStore snapshot stability → React error #185.
  const columnTasks = useMemo(
    () => Object.fromEntries(
      COLUMNS.map((col) => [col, tasks.filter((t) => t.sessionId === sessionId && t.status === col)]),
    ) as Record<KanbanStatus, typeof tasks>,
    [tasks, sessionId],
  );

  function resolveColumn(taskId: string): KanbanStatus | null {
    for (const col of COLUMNS) {
      if (columnTasks[col].some((t) => t.id === taskId)) return col;
    }
    return null;
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // over.id could be a column status or a task id — resolve to column
    const targetStatus = COLUMNS.includes(over.id as KanbanStatus)
      ? (over.id as KanbanStatus)
      : resolveColumn(String(over.id));
    if (targetStatus) moveTask(String(active.id), targetStatus);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DndContext sensors={sensors} onDragStart={(e) => setDragging(String(e.active.id))} onDragEnd={handleDragEnd}>
        <div style={{
          flex: 1, display: 'flex', gap: 'var(--density-gap)',
          padding: 'var(--density-gap) var(--density-pad)',
          overflowX: 'auto', overflowY: 'hidden',
          alignItems: 'flex-start',
        }}>
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columnTasks[status]}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
