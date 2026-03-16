import { useTranslation } from 'react-i18next';
import { LiveClock } from './LiveClock';
import { SessionTabs } from './SessionTabs';
import { TilePicker } from './TilePicker';
import { ScreenPicker } from './ScreenPicker';
import { ProfileMenu } from '../auth/ProfileMenu';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  onAddSession?: () => void;
  isOnline: boolean;
}

export function Topbar({ onAddSession, isOnline }: Props) {
  const { screenProfile } = useSessionStore();
  const isMobile = screenProfile === 'mobile';
  const { t } = useTranslation();

  return (
    <header style={{
      height: 'var(--topbar-h)',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 var(--density-pad)',
      background: 'var(--bg-1)', borderBottom: '1px solid var(--border-0)',
      position: 'relative', zIndex: 100, flexShrink: 0,
    }}>
      {/* Logo */}
      <div className="mono" style={{ fontWeight: 600, color: 'var(--cyan)', fontSize: 'var(--font-sm)', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
        AGENT<span style={{ color: 'var(--text-2)', fontWeight: 400 }}>/MC</span>
      </div>

      {/* Live badge */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xxs)', color: isOnline ? 'var(--green)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? 'var(--green)' : 'var(--text-3)', animation: isOnline ? 'pulse 2s infinite' : 'none' }} />
        {isOnline ? t('topbar.status.live') : t('topbar.status.local')}
      </span>

      {/* Session tabs */}
      {!isMobile && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SessionTabs onAddSession={onAddSession} />
        </div>
      )}

      {isMobile && <div style={{ flex: 1 }} />}

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {!isMobile && <TilePicker />}
        {!isMobile && <ScreenPicker />}
        <LiveClock />
        <ProfileMenu />
      </div>
    </header>
  );
}
