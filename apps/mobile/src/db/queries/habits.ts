// Creating and editing habits (SCOPE.md F2). Archive hides a habit but keeps its history;
// delete is a soft delete (a tombstone, section 8.3), so completions keep their habit.

import type { Category, Difficulty, HabitType } from '@habit-rpg/game-core';
import { localDate } from '@habit-rpg/game-core';
import { and, eq, sql } from 'drizzle-orm';

import { habits } from '../schema';
import type { AppDb } from '../types';
import { getProfile, listActiveHabits, type Habit } from './hero';

export interface HabitFields {
  name: string;
  type: HabitType;
  difficulty: Difficulty;
  category: Category;
  /** Monday = 1 ... Sunday = 64; all days (127) for daily habits. */
  weekdays: number;
  /** 'HH:MM' in the hero's time zone, or null for no reminder (F9). */
  reminderTime: string | null;
}

export function getHabit(db: AppDb, userId: string, habitId: string): Habit | undefined {
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();
}

/** New habits go to the end of the list. */
export function createHabit(
  db: AppDb,
  input: { userId: string; id: string; now: number; fields: HabitFields },
): void {
  db.transaction((tx) => {
    const profile = getProfile(tx, input.userId);
    if (!profile) throw new Error('createHabit: no hero yet');
    const last = tx
      .select({ max: sql<number | null>`max(${habits.sortOrder})` })
      .from(habits)
      .where(eq(habits.userId, input.userId))
      .get();
    tx.insert(habits)
      .values({
        id: input.id,
        userId: input.userId,
        ...input.fields,
        sortOrder: (last?.max ?? -1) + 1,
        createdDate: localDate(input.now, profile.timezone),
        clientUpdatedAt: new Date(input.now).toISOString(),
      })
      .run();
  });
}

function touch(
  db: AppDb,
  userId: string,
  habitId: string,
  now: number,
  set: Partial<typeof habits.$inferInsert>,
): void {
  db.update(habits)
    .set({ ...set, clientUpdatedAt: new Date(now).toISOString() })
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .run();
}

export function updateHabit(
  db: AppDb,
  userId: string,
  habitId: string,
  now: number,
  fields: HabitFields,
): void {
  touch(db, userId, habitId, now, fields);
}

export function archiveHabit(db: AppDb, userId: string, habitId: string, now: number): void {
  touch(db, userId, habitId, now, { archivedAt: new Date(now).toISOString() });
}

export function deleteHabit(db: AppDb, userId: string, habitId: string, now: number): void {
  touch(db, userId, habitId, now, { deletedAt: new Date(now).toISOString() });
}

/**
 * Saves a new order for some of the active habits, e.g. today's quests after a drag. The
 * listed habits take over the places they held between them, in the new order, so habits
 * not on screen (other days' quests) keep their place. Every active habit is renumbered
 * 0, 1, 2... which also repairs duplicate sort orders; only rows whose number changes are
 * written, so sync uploads just those.
 */
export function reorderHabits(db: AppDb, userId: string, orderedIds: string[], now: number): void {
  db.transaction((tx) => {
    const current = listActiveHabits(tx, userId);
    const moving = new Set(orderedIds);
    const queue = orderedIds.filter((id) => current.some((h) => h.id === id));
    const next = current.map((h) => (moving.has(h.id) ? (queue.shift() ?? h.id) : h.id));
    next.forEach((id, index) => {
      const habit = current.find((h) => h.id === id);
      if (habit && habit.sortOrder !== index) touch(tx, userId, id, now, { sortOrder: index });
    });
  });
}
