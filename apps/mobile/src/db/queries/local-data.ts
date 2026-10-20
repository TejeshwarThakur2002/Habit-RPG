import { newHero, type HeroClass } from '@habit-rpg/game-core';

import * as t from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';

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

type Writer = Pick<AppDb, 'delete' | 'insert'>;

/** Deletes every player row. Callers wrap it in a transaction with whatever comes next. */
export function deletePlayerData(tx: Writer): void {
  for (const table of PLAYER_TABLES) tx.delete(table).run();
}

const SIGNED_OUT = { demoMode: false, localOnly: false, onboardingDone: false };

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
    const flags = { onboardingDone: true, demoMode: false };
    tx.insert(t.settings)
      .values({ id: 1, ...flags })
      .onConflictDoUpdate({ target: t.settings.id, set: flags })
      .run();
  });
}
