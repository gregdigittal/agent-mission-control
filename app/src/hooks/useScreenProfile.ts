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
  const { screenProfile, setScreenProfile } = useSessionStore();

  useEffect(() => {
    // Set initial profile
    setScreenProfile(detectProfile());

    const handler = () => setScreenProfile(detectProfile());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return screenProfile;
}
