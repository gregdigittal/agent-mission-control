import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanTask } from '../../types';
import { useKanbanStore } from '../../stores/kanbanStore';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'var(--text-3)', medium: 'var(--blue)', high: 'var(--amber)', critical: 'var(--red)',
};

interface Props {
  task: KanbanTask;
}

export function KanbanCard({ task }: Props) {
  const { approveTask } = useKanbanStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const needsApproval = task.approvalRequired && !task.approvedAt;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--bg-3)',
        border: `1px solid ${needsApproval ? 'var(--amber)' : 'var(--border-1)'}`,
        borderRadius: 5, padding: '8px 10px',
        marginBottom: 6, cursor: 'grab',
        boxShadow: needsApproval ? '0 0 6px var(--amber)22' : 'none',
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      {/* Priority + approval */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: PRIORITY_COLORS[task.priority] ?? 'var(--text-3)',
          flexShrink: 0,
        }} />
        {needsApproval && (
          <span style={{
            fontSize: 'var(--font-xxs)', color: 'var(--amber)',
            background: 'var(--amber)22', padding: '0 4px', borderRadius: 3,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Awaiting Approval
          </span>
        )}
      </div>

      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-0)', marginBottom: 4 }}>
        {task.title}
      </div>

      {task.description && (
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 6 }}>
          {task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}
        </div>
      )}

      {/* Recommended by agent */}
      {task.recommendedByAgent && (
        <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--violet)', marginBottom: needsApproval ? 6 : 0 }}>
          ✦ Recommended by {task.recommendedByAgent}
        </div>
      )}

      {/* Approve button */}
      {needsApproval && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); approveTask(task.id); }}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 3, fontSize: 'var(--font-xxs)',
              background: 'var(--green)', color: '#06080c', fontWeight: 600,
            }}
          >
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
