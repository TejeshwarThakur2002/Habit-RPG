import { and, asc, eq, isNull } from 'drizzle-orm';

import { characters, habits, inventory, profiles } from '../schema';
import type { AppDb } from '../types';

export type Profile = typeof profiles.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Habit = typeof habits.$inferSelect;

export function getProfile(db: AppDb, userId: string): Profile | undefined {
  return db.select().from(profiles).where(eq(profiles.id, userId)).get();
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
