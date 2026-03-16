import type { AgentStatus } from '../../types';

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  idle:             { label: 'Idle',       color: 'var(--text-2)',  dot: 'var(--text-3)' },
  running:          { label: 'Running',    color: 'var(--green)',   dot: 'var(--green)' },
  waiting_approval: { label: 'Waiting',    color: 'var(--amber)',   dot: 'var(--amber)' },
  paused:           { label: 'Paused',     color: 'var(--blue)',    dot: 'var(--blue)' },
  error:            { label: 'Error',      color: 'var(--red)',     dot: 'var(--red)' },
  complete:         { label: 'Complete',   color: 'var(--cyan)',    dot: 'var(--cyan)' },
};

interface Props {
  status: AgentStatus;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status];
  const isLive = status === 'running';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 'var(--font-xxs)', color: cfg.color,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.dot,
        animation: isLive ? 'pulse 2s infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
}
