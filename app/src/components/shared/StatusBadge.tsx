import { useTranslation } from 'react-i18next';
import type { AgentStatus } from '../../types';

const STATUS_COLORS: Record<AgentStatus, { color: string; dot: string }> = {
  idle:             { color: 'var(--text-2)',  dot: 'var(--text-3)' },
  running:          { color: 'var(--green)',   dot: 'var(--green)' },
  waiting_approval: { color: 'var(--amber)',   dot: 'var(--amber)' },
  paused:           { color: 'var(--blue)',    dot: 'var(--blue)' },
  error:            { color: 'var(--red)',     dot: 'var(--red)' },
  complete:         { color: 'var(--cyan)',    dot: 'var(--cyan)' },
};

interface Props {
  status: AgentStatus;
}

export function StatusBadge({ status }: Props) {
  const { t } = useTranslation();
  const { color, dot } = STATUS_COLORS[status];
  const isLive = status === 'running';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 'var(--font-xxs)', color,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dot,
        animation: isLive ? 'pulse 2s infinite' : 'none',
      }} />
      {t(`agent.status.${status}`)}
    </span>
  );
}
