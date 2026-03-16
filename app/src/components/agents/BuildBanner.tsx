import { ProgressRing } from '../shared/ProgressRing';
import { useAgentStore } from '../../stores/agentStore';
import type { BuildStage } from '../../types';

const STAGES: BuildStage[] = ['plan','scaffold','build','test','review','fix','deploy','done'];

interface Props {
  sessionId: string;
}

export function BuildBanner({ sessionId }: Props) {
  const agents = useAgentStore((s) => s.agentsBySession(sessionId));
  const running = agents.filter((a) => a.status === 'running');

  if (running.length === 0) return null;

  // Use the first running agent's stage for the banner
  const lead = running[0];
  const stage = lead.buildStage ?? 'build';
  const stageIdx = STAGES.indexOf(stage);
  const progress = lead.buildProgress;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px var(--density-pad)',
      background: 'var(--bg-2)', borderBottom: '1px solid var(--border-0)',
    }}>
      <ProgressRing value={progress} size={Number(getComputedStyle(document.documentElement).getPropertyValue('--bb-ring-size').trim()) || 54}>
        <span style={{ fontSize: 'var(--font-xxs)' }}>{progress}%</span>
      </ProgressRing>

      <div style={{ flex: 1, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx;
            return (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}>
                {i > 0 && (
                  <div style={{ width: 12, height: 1, background: done ? 'var(--cyan)' : 'var(--border-1)' }} />
                )}
                <span style={{
                  fontSize: 'var(--bb-stage-size, 13px)',
                  color: active ? 'var(--cyan)' : done ? 'var(--green)' : 'var(--text-3)',
                  fontWeight: active ? 600 : 400,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)', flexShrink: 0 }}>
        {running.length} agent{running.length > 1 ? 's' : ''} running
      </div>
    </div>
  );
}
