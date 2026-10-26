// Runs the first sync from the app, with the real transport (D48). The sign-in, link and
// onboarding screens call it, and the two-heroes choice (D49); the logic and its tests live in
// first-sync.ts.

import Constants from 'expo-constants';

import { db } from '@/db/client';
import { newId } from '@/lib/device';
import { sendSync } from '@/lib/supabase';

import {
  runFirstSync,
  takeAccountHero,
  type FirstSyncChoice,
  type FirstSyncOutcome,
} from './first-sync';
import { askHeroChoice } from './hero-choice';
import { pushRejections } from './notices';

const options = () => ({
  db,
  transport: { send: sendSync },
  appVersion: Constants.expoConfig?.version ?? 'unknown',
  newId,
  now: Date.now,
});

export async function firstSyncNow(
  accountUserId: string,
  choice: FirstSyncChoice = {},
): Promise<FirstSyncOutcome> {
  const outcome = await runFirstSync(options(), accountUserId, choice);
  if (outcome.status === 'done') pushRejections(outcome.rejected);
  // Both have a hero: the player chooses which to keep.
  else if (outcome.status === 'conflict') {
    askHeroChoice({ accountUserId, accountHero: outcome.accountHero });
  }
  // Other failures retry with the normal triggers.
  else console.warn('first sync did not finish', outcome.status);
  return outcome;
}

/** "Use my account's hero": the account's hero replaces this phone's. */
export function takeAccountHeroNow(accountUserId: string): Promise<FirstSyncOutcome> {
  return takeAccountHero(options(), accountUserId);
}
