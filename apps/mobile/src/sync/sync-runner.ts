// The app's one sync service, with the real transport and timers (D51). The screens that start a
// first sync and the app's triggers all go through it; the logic and its tests live in
// sync-service.ts.

import Constants from 'expo-constants';

import { db } from '@/db/client';
import { newId } from '@/lib/device';
import { sendSync } from '@/lib/supabase';

import type { FirstSyncChoice, FirstSyncOutcome } from './first-sync';
import { withOfflineSwitch } from './offline-switch';
import { createSyncService } from './sync-service';

export const syncService = createSyncService({
  db,
  transport: withOfflineSwitch({ send: sendSync }),
  appVersion: Constants.expoConfig?.version ?? 'unknown',
  newId,
  now: Date.now,
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function firstSyncNow(
  accountUserId: string,
  choice: FirstSyncChoice = {},
): Promise<FirstSyncOutcome> {
  return syncService.firstSync(accountUserId, choice);
}

/** "Use my account's hero": the account's hero replaces this phone's. */
export function takeAccountHeroNow(accountUserId: string): Promise<FirstSyncOutcome> {
  return syncService.takeAccountHero(accountUserId);
}
