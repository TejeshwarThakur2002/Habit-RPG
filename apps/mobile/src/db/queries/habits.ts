// Creating and editing habits (SCOPE.md F2). Archive hides a habit but keeps its history;
// delete is a soft delete (a tombstone, section 8.3), so completions keep their habit.

import type { Category, Difficulty, HabitType } from '@habit-rpg/game-core';
import { localDate } from '@habit-rpg/game-core';
import { and, eq, sql } from 'drizzle-orm';

import { habits } from '../schema';
import type { AppDb } from '../types';
import { getProfile, type Habit } from './hero';

export interface HabitFields {
  name: string;
  type: HabitType;
  difficulty: Difficulty;
  category: Category;
  /** Monday = 1 ... Sunday = 64; all days (127) for daily habits. */
  weekdays: number;
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
