import { newHero, type HeroClass } from '@habit-rpg/game-core';

import * as t from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';
import { getProfile } from './hero';
import { enqueue, profileChange } from './outbox';
import { resetCursor } from './sync-state';

// Everything that belongs to the local player. Settings and sync state are device-level.
const PLAYER_TABLES = [
  t.completions,
  t.habits,
  t.inventory,
  t.dayClosures,
  t.characters,
  t.profiles,
  t.partyEvents,
  t.bossWeeks,
  t.partyMembers,
  t.parties,
  t.outbox,
] as const;

type Writer = Pick<AppDb, 'delete' | 'insert' | 'update'>;

/**
 * Deletes every player row and rewinds the sync cursor, so the next account starts from the
 * beginning. Callers wrap it in a transaction with whatever comes next.
 */
export function deletePlayerData(tx: Writer): void {
  for (const table of PLAYER_TABLES) tx.delete(table).run();
  resetCursor(tx);
}

// A pending faint belongs to the player, so it goes whenever player data does.
const SIGNED_OUT = {
  demoMode: false,
  localOnly: false,
  onboardingDone: false,
  pendingFaint: null,
  accountUserId: null,
  accountEmail: null,
};

/** Leaves the demo (or the local game): wipes player data and returns to sign-in. */
export function resetLocalData(db: AppDb): void {
  db.transaction((tx) => {
    deletePlayerData(tx);
    tx.insert(t.settings)
      .values({ id: 1, ...SIGNED_OUT })
      .onConflictDoUpdate({ target: t.settings.id, set: SIGNED_OUT })
      .run();
  });
}

/**
 * Records a successful email sign-in (SCOPE.md F1). The session itself is kept by supabase-js
 * in secure storage; these settings let the route guard decide synchronously (D33). Without a
 * hero yet, the route guard then opens onboarding.
 */
export function recordSignIn(db: AppDb, account: { id: string; email: string }): void {
  // Linking a local hero (D34) turns "playing without an account" off but keeps every row.
  const flags = {
    accountUserId: account.id,
    accountEmail: account.email,
    demoMode: false,
    localOnly: false,
  };
  db.insert(t.settings)
    .values({ id: 1, ...flags })
    .onConflictDoUpdate({ target: t.settings.id, set: flags })
    .run();
}

export interface NewHeroInput {
  heroName: string;
  heroClass: HeroClass;
  timeZone: string;
  now: number;
}

/**
 * Onboarding's last step (SCOPE.md F1): a level 1 hero with 44 HP and no gold. Replaces any
 * leftover demo data, and marks onboarding done so the route guard opens the tabs.
 */
export function createHero(db: AppDb, input: NewHeroInput): void {
  const userId = LOCAL_USER_ID;
  const createdAt = new Date(input.now).toISOString();
  db.transaction((tx) => {
    deletePlayerData(tx);
    tx.insert(t.profiles)
      .values({
        id: userId,
        heroName: input.heroName,
        heroClass: input.heroClass,
        timezone: input.timeZone,
        createdAt,
      })
      .run();
    tx.insert(t.characters)
      .values({ userId, ...newHero() })
      .run();
    // Signed in first, then onboarded: the new hero's profile is the account's first change.
    const profile = getProfile(tx, userId);
    if (profile) enqueue(tx, profileChange(profile, input.now), input.now);
    const flags = { onboardingDone: true, demoMode: false, pendingFaint: null };
    tx.insert(t.settings)
      .values({ id: 1, ...flags })
      .onConflictDoUpdate({ target: t.settings.id, set: flags })
      .run();
  });
}
