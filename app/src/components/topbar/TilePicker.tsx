import { useSessionStore } from '../../stores/sessionStore';
import type { PaneCount } from '../../types';

const LAYOUTS: { count: PaneCount; icon: string }[] = [
  { count: 1, icon: '▣' },
  { count: 2, icon: '⬛⬛' },
  { count: 3, icon: '⬛⬛⬛' },
  { count: 4, icon: '⊞' },
];

export function TilePicker() {
  const { paneCount, setPaneCount, screenProfile } = useSessionStore();
  if (screenProfile === 'mobile') return null;

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {LAYOUTS.map(({ count, icon }) => (
        <button
          key={count}
          onClick={() => setPaneCount(count)}
          title={`${count} pane${count > 1 ? 's' : ''}`}
          style={{
            width: 22, height: 22, borderRadius: 3, fontSize: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: paneCount === count ? 'var(--bg-4)' : 'transparent',
            color: paneCount === count ? 'var(--text-0)' : 'var(--text-3)',
            border: `1px solid ${paneCount === count ? 'var(--border-2)' : 'transparent'}`,
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
