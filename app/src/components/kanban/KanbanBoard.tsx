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

  const { tasksByStatus, moveTask, setDragging } = useKanbanStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // over.id could be a column status or a task id — resolve to column
    const targetStatus = COLUMNS.includes(over.id as KanbanStatus)
      ? (over.id as KanbanStatus)
      : resolveColumn(String(over.id), sessionId);
    if (targetStatus) moveTask(String(active.id), targetStatus);
  }

  function resolveColumn(taskId: string, sid: string): KanbanStatus | null {
    for (const col of COLUMNS) {
      if (tasksByStatus(sid, col).some((t) => t.id === taskId)) return col;
    }
    return null;
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
              tasks={tasksByStatus(sessionId, status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
