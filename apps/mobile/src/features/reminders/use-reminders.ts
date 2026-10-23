import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { db } from '@/db/client';
import { getReminderPlan } from '@/db/queries/reminders';
import { LOCAL_USER_ID } from '@/db/types';
import { bookReminders, setUpNotifications } from '@/lib/notifications';

// A burst of writes (completing a quest touches several tables) books reminders once.
const SETTLE_MS = 500;

let requestBooking: (() => void) | null = null;

/** Rebooks now, e.g. right after notifications were allowed, which changes no data. */
export function refreshReminders(): void {
  requestBooking?.();
}

/**
 * Keeps the phone's booked reminders in step with SQLite (SCOPE.md F9): after every database
 * change, and whenever the app opens, so the rolling 7-day window moves forward. Runs one
 * booking at a time; a change during a booking triggers one more afterwards.
 */
export function useReminders(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let again = false;

    const book = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          await bookReminders(getReminderPlan(db, LOCAL_USER_ID, Date.now()));
        } while (again);
      } catch (error: unknown) {
        // A refused booking must not break the app; the next change or open tries again.
        console.warn('Booking reminders failed', error);
      } finally {
        running = false;
      }
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void book(), SETTLE_MS);
    };

    requestBooking = soon;
    setUpNotifications()
      .then(book)
      .catch((error: unknown) => console.warn('Setting up notifications failed', error));
    const dbSubscription = addDatabaseChangeListener(soon);
    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') soon();
    });
    return () => {
      requestBooking = null;
      clearTimeout(timer);
      dbSubscription.remove();
      appSubscription.remove();
    };
  }, []);
}
