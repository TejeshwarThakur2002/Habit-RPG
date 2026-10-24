import { and, asc, eq, isNull } from 'drizzle-orm';

import { characters, habits, inventory, partyMembers, profiles } from '../schema';
import type { AppDb } from '../types';
import { enqueue, profileChange } from './outbox';

export type Profile = typeof profiles.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type ProfilePatch = Partial<Pick<Profile, 'heroName' | 'timezone'>>;

export function getProfile(db: AppDb, userId: string): Profile | undefined {
  return db.select().from(profiles).where(eq(profiles.id, userId)).get();
}

/**
 * Settings' hero name and time zone (SCOPE.md F10). The party read-model keeps its own copy of
 * the name, so it is renamed in the same transaction and the party never shows the old one.
 * A new time zone only moves "today" from now on; days already closed stay closed.
 */
export function updateProfile(db: AppDb, userId: string, patch: ProfilePatch, now: number): void {
  db.transaction((tx) => {
    tx.update(profiles).set(patch).where(eq(profiles.id, userId)).run();
    const profile = getProfile(tx, userId);
    if (profile) enqueue(tx, profileChange(profile, now), now);
    if (patch.heroName !== undefined) {
      tx.update(partyMembers)
        .set({ heroName: patch.heroName })
        .where(eq(partyMembers.userId, userId))
        .run();
    }
  });
}

export function getCharacter(db: AppDb, userId: string): Character | undefined {
  return db.select().from(characters).where(eq(characters.userId, userId)).get();
}

/** Habits shown on the Quests tab: not archived or deleted, in the user's order. */
export function listActiveHabits(db: AppDb, userId: string): Habit[] {
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt), isNull(habits.deletedAt)))
    .orderBy(asc(habits.sortOrder))
    .all();
}

export function listEquippedGear(db: AppDb, userId: string) {
  return db
    .select({ itemId: inventory.itemId })
    .from(inventory)
    .where(and(eq(inventory.userId, userId), eq(inventory.equipped, true)))
    .all()
    .map((row) => row.itemId);
}
