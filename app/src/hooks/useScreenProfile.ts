import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { ScreenProfile } from '../types';

function detectProfile(): ScreenProfile {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1280) return 'laptop';
  if (w < 1920) return 'desktop';
  return 'ultrawide';
}

export function useScreenProfile(): ScreenProfile {
  // Use selectors to subscribe only to the specific slice needed, preventing
  // unrelated store updates from triggering useSyncExternalStore tearing checks
  // on this component (which was a contributor to React error #185).
  const screenProfile = useSessionStore((s) => s.screenProfile);
  const setScreenProfile = useSessionStore((s) => s.setScreenProfile);

  useEffect(() => {
    // Do not set on mount — screenProfile is already initialised from
    // window.innerWidth in the store creator (detectScreenProfile).
    // Setting it here caused a Zustand useSyncExternalStore cascade during
    // the React commit phase, triggering React error #185.
    const handler = () => setScreenProfile(detectProfile());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [setScreenProfile]);

  return screenProfile;
}
