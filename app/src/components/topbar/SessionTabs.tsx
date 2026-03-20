import { useSessionStore } from '../../stores/sessionStore';
import type { Session } from '../../types';

const COLOR_MAP: Record<string, string> = {
  cyan: 'var(--cyan)', green: 'var(--green)', violet: 'var(--violet)',
  amber: 'var(--amber)', rose: 'var(--rose)', blue: 'var(--blue)',
};

interface Props {
  onAddSession?: () => void;
}

export function SessionTabs({ onAddSession }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const panes = useSessionStore((s) => s.panes);
  const activePane = useSessionStore((s) => s.activePane);
  const setPaneSession = useSessionStore((s) => s.setPaneSession);
  const screenProfile = useSessionStore((s) => s.screenProfile);

  if (screenProfile === 'mobile') return null;

  const activeSession = panes.find((p) => p.id === activePane)?.sessionId;

  return (
    <div role="tablist" aria-label="Sessions" style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
      {sessions.map((s: Session) => {
        const color = COLOR_MAP[s.color] ?? 'var(--cyan)';
        const active = activeSession === s.id;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            aria-label={`Session: ${s.name}`}
            onClick={() => activePane && setPaneSession(activePane, s.id)}
            style={{
              padding: '2px 10px', borderRadius: 4, fontSize: 'var(--font-xs)',
              background: active ? 'var(--bg-4)' : 'transparent',
              color: active ? color : 'var(--text-2)',
              border: `1px solid ${active ? color + '44' : 'transparent'}`,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, marginRight: 5 }} />
            {s.name}
          </button>
        );
      })}
      {onAddSession && (
        <button
          onClick={onAddSession}
          aria-label="Add session"
          style={{
            width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-3)', fontSize: 16,
            border: '1px dashed var(--border-1)',
          }}
          title="Add session"
        >
          <span aria-hidden="true">+</span>
        </button>
      )}
    </div>
  );
}
