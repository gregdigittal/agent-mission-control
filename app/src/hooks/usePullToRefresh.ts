import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD_PX = 64;

interface PullToRefreshResult {
  /** Attach to the scrollable container element. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** True while the refresh is in progress — show a loading indicator. */
  isRefreshing: boolean;
}

/**
 * Pull-to-refresh for mobile.
 * Attach containerRef to the scrollable element.
 * onRefresh is called when the user pulls down past the threshold.
 * Only fires when the container is scrolled to the top.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void): PullToRefreshResult {
  const containerRef = useRef<HTMLElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only activate when scrolled to top
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchEnd = async (e: TouchEvent) => {
      if (!pulling.current) return;
      pulling.current = false;

      const deltaY = e.changedTouches[0].clientY - startY.current;
      if (deltaY < PULL_THRESHOLD_PX) return;

      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    };

    const onTouchCancel = () => { pulling.current = false; };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onRefresh]);

  return { containerRef, isRefreshing };
}
