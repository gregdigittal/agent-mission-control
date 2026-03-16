import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../shared/StatusBadge';
import { ProgressRing } from '../shared/ProgressRing';
import { formatCost, getProviderLabel } from '../../lib/cost';
import type { Agent } from '../../types';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'var(--cyan)',
  openai: 'var(--green)',
  google: 'var(--blue)',
  ollama: 'var(--violet)',
  custom: 'var(--amber)',
};

interface Props {
  agent: Agent;
  onSelect?: (id: string) => void;
  selected?: boolean;
}

export function AgentCard({ agent, onSelect, selected }: Props) {
  const { t } = useTranslation();
  const contextPct = agent.contextUsagePct
    ?? (agent.contextLimit > 0 ? Math.round((agent.contextUsed / agent.contextLimit) * 100) : 0);
  const color = PROVIDER_COLORS[agent.provider] ?? 'var(--cyan)';
  const ringColor = contextPct >= 80 ? 'var(--rose)' : contextPct >= 60 ? 'var(--amber)' : color;

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? t('agent.card.selectAriaLabel', { name: agent.name }) : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={() => onSelect?.(agent.id)}
      onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(agent.id); } }}
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${selected ? 'var(--cyan)' : 'var(--border-1)'}`,
        borderRadius: 6, padding: 'var(--card-pad)',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        boxShadow: selected ? '0 0 8px var(--cyan)22' : 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <ProgressRing value={contextPct} size={42} stroke={3} color={ringColor}>
          <span style={{ fontSize: 8, color: ringColor }}>{contextPct}%</span>
        </ProgressRing>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.name}
            </span>
            <span style={{ fontSize: 'var(--font-xxs)', color, background: color + '22', borderRadius: 3, padding: '1px 4px' }}>
              {getProviderLabel(agent.provider)}
            </span>
            {contextPct >= 80 && (
              <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--rose)', background: 'var(--rose)22', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                {t('agent.card.compactNow')}
              </span>
            )}
            {contextPct >= 60 && contextPct < 80 && (
              <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--amber)', background: 'var(--amber)22', borderRadius: 3, padding: '1px 5px' }}>
                {t('agent.card.contextPct', { pct: contextPct })}
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent.role}
          </div>
        </div>

        <StatusBadge status={agent.status} />
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <div style={{
          fontSize: 'var(--font-xs)', color: 'var(--text-1)',
          padding: '4px 6px', background: 'var(--bg-3)', borderRadius: 4,
          marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {agent.currentTask}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
        <span>↑{(agent.tokensIn / 1000).toFixed(1)}k</span>
        <span>↓{(agent.tokensOut / 1000).toFixed(1)}k</span>
        <span style={{ color: 'var(--amber)' }}>{formatCost(agent.costUsd)}</span>
        <span style={{ marginLeft: 'auto' }}>
          {agent.model.split('/').pop()}
        </span>
      </div>
    </div>
  );
}
