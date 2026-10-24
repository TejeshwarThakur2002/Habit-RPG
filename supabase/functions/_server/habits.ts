// The player's habits as game-core's day rules see them: archive and delete times become local
// dates in the player's time zone, so "was it active that day" is asked the same way as on the
// phone (D17).

import type { TransactionSql } from 'postgres';

import {
  localDate,
  type Category,
  type ClosingHabit,
  type Difficulty,
  type HabitType,
} from '../_shared/game-core/index.ts';

export type ServerHabit = ClosingHabit & { category: Category };

function toServerHabit(row: Record<string, unknown>, timeZone: string): ServerHabit {
  const toDate = (t: unknown) => (t ? localDate((t as Date).getTime(), timeZone) : null);
  return {
    id: row.id as string,
    type: row.type as HabitType,
    difficulty: row.difficulty as Difficulty,
    category: row.category as Category,
    weekdays: row.weekdays as number,
    createdDate: row.created_date as string,
    archivedDate: toDate(row.archived_at),
    deletedDate: toDate(row.deleted_at),
  };
}

/** One habit with its owner, who may be another player. */
export async function loadHabit(sql: TransactionSql, habitId: string, timeZone: string) {
  const [row] = await sql`
    select id, user_id, type, difficulty, category, weekdays,
           created_date::text as created_date, archived_at, deleted_at
    from public.habits where id = ${habitId}`;
  if (!row) return null;
  return { owner: row.user_id as string, habit: toServerHabit(row, timeZone) };
}

/** Every habit the player has had, archived and deleted ones included. */
export async function loadHabits(
  sql: TransactionSql,
  userId: string,
  timeZone: string,
): Promise<ServerHabit[]> {
  const rows = await sql`
    select id, type, difficulty, category, weekdays,
           created_date::text as created_date, archived_at, deleted_at
    from public.habits where user_id = ${userId}`;
  return rows.map((row) => toServerHabit(row, timeZone));
}
