// Pulling (SCOPE.md section 8.3): the player's rows with server_seq above the phone's cursor,
// oldest first, 500 at a time. server_seq comes from one global sequence, so ordering by it
// across tables is the order the changes happened.

import type { TransactionSql } from 'postgres';

import type { ServerChange } from '../_shared/shared/index.ts';
import {
  completionChange,
  dayClosureChange,
  habitChange,
  inventoryChange,
  profileChange,
} from './rows.ts';

export const PAGE_SIZE = 500;

export interface Pulled {
  changes: ServerChange[];
  cursor: number;
  hasMore: boolean;
}

/** One query per table, each capped at one more than a page, then merged in seq order. */
export async function pullChanges(
  sql: TransactionSql,
  userId: string,
  cursor: number,
): Promise<Pulled> {
  const limit = PAGE_SIZE + 1;
  const [profiles, habits, completions, inventory, closures] = await Promise.all([
    sql`select * from public.profiles
        where id = ${userId} and server_seq > ${cursor} order by server_seq limit ${limit}`,
    sql`select *, created_date::text as created_date,
               to_char(reminder_time, 'HH24:MI') as reminder_time
        from public.habits
        where user_id = ${userId} and server_seq > ${cursor} order by server_seq limit ${limit}`,
    sql`select *, local_date::text as local_date from public.completions
        where user_id = ${userId} and server_seq > ${cursor} order by server_seq limit ${limit}`,
    sql`select * from public.inventory
        where user_id = ${userId} and server_seq > ${cursor} order by server_seq limit ${limit}`,
    sql`select *, local_date::text as local_date from public.day_closures
        where user_id = ${userId} and server_seq > ${cursor} order by server_seq limit ${limit}`,
  ]);
  const rows = [
    ...profiles.map((r) => ({ seq: Number(r.server_seq), change: profileChange(r) })),
    ...habits.map((r) => ({ seq: Number(r.server_seq), change: habitChange(r) })),
    ...completions.map((r) => ({ seq: Number(r.server_seq), change: completionChange(r) })),
    ...inventory.map((r) => ({ seq: Number(r.server_seq), change: inventoryChange(r) })),
    ...closures.map((r) => ({ seq: Number(r.server_seq), change: dayClosureChange(r) })),
  ].sort((a, b) => a.seq - b.seq);

  const page = rows.slice(0, PAGE_SIZE);
  return {
    changes: page.map((r) => r.change),
    cursor: page.length > 0 ? page[page.length - 1]!.seq : cursor,
    hasMore: rows.length > PAGE_SIZE,
  };
}
