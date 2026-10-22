import { useEffect } from 'react';
import { AppState } from 'react-native';

import { db } from '@/db/client';
import { closeDays } from '@/db/queries/day-close';
import { LOCAL_USER_ID } from '@/db/types';

/**
 * Closes any finished days when the tabs open and whenever the app comes back to the
 * foreground (SCOPE.md P2, local day close on app open). A phone left open overnight
 * catches up the next time it is used. The screens repaint through useDbQuery.
 */
export function useDayClose(): void {
  useEffect(() => {
    const run = () => closeDays(db, LOCAL_USER_ID, Date.now());
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, []);
}
