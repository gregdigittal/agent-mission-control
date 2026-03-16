import { BuildBanner } from './BuildBanner';
import { AgentCard } from './AgentCard';
import { ActivityStream } from './ActivityStream';
import { useAgentStore } from '../../stores/agentStore';

interface Props {
  sessionId: string;
}

export function AgentView({ sessionId }: Props) {
  const agents = useAgentStore((s) => s.agentsBySession(sessionId));
  const { eventFilter, setEventFilter } = useAgentStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <BuildBanner sessionId={sessionId} />

      {/* Agent cards */}
      <div style={{
        padding: 'var(--density-gap) var(--density-pad)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--density-gap)',
        flexShrink: 0,
      }}>
        {agents.length === 0 ? (
          <div style={{ gridColumn: '1/-1', color: 'var(--text-3)', fontSize: 'var(--font-xs)', textAlign: 'center', padding: 16 }}>
            No agents in this session
          </div>
        ) : (
          agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              selected={eventFilter === a.id}
              onSelect={(id) => setEventFilter(eventFilter === id ? null : id)}
            />
          ))
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-0)', flexShrink: 0 }} />

      {/* Activity stream */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ActivityStream sessionId={sessionId} />
      </div>
    </div>
  );
}
