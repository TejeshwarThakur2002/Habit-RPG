// Runs the first sync from the app, with the real transport (D48). The sign-in, link and
// onboarding screens call it; the logic and its tests live in first-sync.ts.

import Constants from 'expo-constants';

import { db } from '@/db/client';
import { newId } from '@/lib/device';
import { sendSync } from '@/lib/supabase';

import { runFirstSync, type FirstSyncOutcome } from './first-sync';
import { pushRejections } from './notices';

export async function firstSyncNow(accountUserId: string): Promise<FirstSyncOutcome> {
  const outcome = await runFirstSync(
    {
      db,
      transport: { send: sendSync },
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      newId,
      now: Date.now,
    },
    accountUserId,
  );
  if (outcome.status === 'done') pushRejections(outcome.rejected);
  // A conflict waits for the two-heroes choice (E2); other failures retry with the normal triggers.
  if (outcome.status !== 'done') console.warn('first sync did not finish', outcome.status);
  return outcome;
}
