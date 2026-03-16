import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { KanbanStatus, KanbanTask } from '../../types';

const COLUMN_LABELS: Record<KanbanStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

const COLUMN_COLORS: Record<KanbanStatus, string> = {
  backlog: 'var(--text-3)',
  todo: 'var(--blue)',
  in_progress: 'var(--cyan)',
  review: 'var(--violet)',
  done: 'var(--green)',
  blocked: 'var(--red)',
};

interface Props {
  status: KanbanStatus;
  tasks: KanbanTask[];
}

export function KanbanColumn({ status, tasks }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = COLUMN_COLORS[status];

  return (
    <div style={{
      width: 'var(--kb-col-w)', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', marginBottom: 6,
        borderBottom: `2px solid ${color}`,
      }}>
        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-0)' }}>
          {COLUMN_LABELS[status]}
        </span>
        <span style={{
          fontSize: 'var(--font-xxs)', color,
          background: color + '22', borderRadius: 3, padding: '0 5px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1, minHeight: 80,
          background: isOver ? 'var(--bg-4)' : 'transparent',
          borderRadius: 5, padding: isOver ? '4px' : '0',
          transition: 'background 0.15s',
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <KanbanCard key={t.id} task={t} />)}
        </SortableContext>
      </div>
    </div>
  );
}
