import { useEffect, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_MAX_VERTICAL_PX = 80; // prevent triggering during scroll

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Attaches horizontal swipe gesture detection to the returned ref.
 * Swipe left → onSwipeLeft (advance to next tab).
 * Swipe right → onSwipeRight (go to previous tab).
 * Ignores gestures that are primarily vertical (user scrolling).
 */
export function useSwipeGesture<T extends HTMLElement>({
  onSwipeLeft,
  onSwipeRight,
}: SwipeHandlers): React.RefObject<T> {
  const ref = useRef<T>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - startX.current;
      const deltaY = Math.abs(e.changedTouches[0].clientY - startY.current);

      // Ignore if vertical movement dominates (user scrolling)
      if (deltaY > SWIPE_MAX_VERTICAL_PX) return;

      if (deltaX < -SWIPE_THRESHOLD_PX) {
        onSwipeLeft?.();
      } else if (deltaX > SWIPE_THRESHOLD_PX) {
        onSwipeRight?.();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);

  return ref;
}
