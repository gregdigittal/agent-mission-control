import { useSessionStore } from '../../stores/sessionStore';
import type { ScreenProfile } from '../../types';

const PROFILES: { value: ScreenProfile; label: string; ariaLabel: string }[] = [
  { value: 'mobile',     label: '📱', ariaLabel: 'Mobile layout' },
  { value: 'laptop',     label: '💻', ariaLabel: 'Laptop layout' },
  { value: 'desktop',    label: '🖥',  ariaLabel: 'Desktop layout' },
  { value: 'ultrawide',  label: '⬛', ariaLabel: 'Ultrawide layout' },
];

export function ScreenPicker() {
  const { screenProfile, setScreenProfile } = useSessionStore();

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {PROFILES.map(({ value, label, ariaLabel }) => (
        <button
          key={value}
          onClick={() => setScreenProfile(value)}
          title={ariaLabel}
          aria-label={ariaLabel}
          aria-pressed={screenProfile === value}
          style={{
            width: 22, height: 22, borderRadius: 3, fontSize: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: screenProfile === value ? 'var(--bg-4)' : 'transparent',
            color: screenProfile === value ? 'var(--text-0)' : 'var(--text-3)',
            border: `1px solid ${screenProfile === value ? 'var(--border-2)' : 'transparent'}`,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
