import { useMemo } from 'react';
import { BuildBanner } from './BuildBanner';
import { AgentCard } from './AgentCard';
import { ActivityStream } from './ActivityStream';
import { ConflictPanel } from '../git/ConflictPanel';
import { useAgentStore } from '../../stores/agentStore';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  sessionId: string;
}

export function AgentView({ sessionId }: Props) {
  const rawAgents = useAgentStore((s) => s.agents);
  const agents = useMemo(
    () => Object.values(rawAgents).filter((a) => a.sessionId === sessionId),
    [rawAgents, sessionId],
  );
  const eventFilter = useAgentStore((s) => s.eventFilter);
  const setEventFilter = useAgentStore((s) => s.setEventFilter);
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));

  const conflictFiles = session?.conflictFiles ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <BuildBanner sessionId={sessionId} />

      {/* Conflict panel — shown only when conflicts exist */}
      {conflictFiles.length > 0 && (
        <div style={{ padding: '8px 8px 0' }}>
          <ConflictPanel sessionId={sessionId} conflictFiles={conflictFiles} />
        </div>
      )}

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
