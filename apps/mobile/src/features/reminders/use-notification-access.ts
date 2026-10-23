import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  askForNotifications,
  getNotificationAccess,
  type NotificationAccess,
} from '@/lib/notifications';

import { refreshReminders } from './use-reminders';

/**
 * The phone's notification permission, read again whenever the app returns to the foreground,
 * since the player may have just changed it in the phone's Settings. Null until first read.
 */
export function useNotificationAccess() {
  const [access, setAccess] = useState<NotificationAccess | null>(null);

  useEffect(() => {
    const read = () =>
      getNotificationAccess()
        .then(setAccess)
        .catch((error: unknown) => console.warn('Reading notification permission failed', error));
    void read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void read();
    });
    return () => subscription.remove();
  }, []);

  const ask = useCallback(() => {
    askForNotifications()
      .then((next) => {
        setAccess(next);
        if (next === 'granted') refreshReminders();
      })
      .catch((error: unknown) => console.warn('Asking for notifications failed', error));
  }, []);

  return { access, ask };
}
