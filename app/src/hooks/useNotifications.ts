/**
 * useNotifications — browser push notification hook.
 *
 * Requests Notification permission on first call, then exposes a
 * `notify(title, options)` helper that fires a browser notification
 * only when permission is granted and the tab is not focused.
 *
 * Designed for M8-009: notify operators when a new approval request arrives.
 */

import { useCallback, useEffect, useRef } from 'react';

type NotificationPermission = 'default' | 'granted' | 'denied';

export interface UseNotificationsReturn {
  /** Current permission state */
  permission: NotificationPermission;
  /** Request permission explicitly (called automatically on first notify) */
  requestPermission: () => Promise<NotificationPermission>;
  /** Fire a browser notification if permitted and tab is not focused */
  notify: (title: string, options?: NotificationOptions) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const permissionRef = useRef<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  // Keep permissionRef in sync if the user grants/denies outside this hook
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    permissionRef.current = Notification.permission;
  });

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    const result = await Notification.requestPermission();
    permissionRef.current = result;
    return result;
  }, []);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof Notification === 'undefined') return;

      // Don't distract if the tab is already focused
      if (document.visibilityState === 'visible') return;

      if (Notification.permission !== 'granted') {
        // Try to request permission, then fire
        void requestPermission().then((p) => {
          if (p === 'granted') new Notification(title, options);
        });
        return;
      }

      new Notification(title, options);
    },
    [requestPermission],
  );

  return {
    permission: permissionRef.current,
    requestPermission,
    notify,
  };
}
