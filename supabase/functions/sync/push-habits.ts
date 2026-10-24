// Pushing habits (SCOPE.md section 8.3, conflict rules): last write wins per row by the
// phone's client_updated_at, ties going to the later arrival, and a delete (a deleted_at
// tombstone) beats every later edit.

import type { TransactionSql } from 'postgres';

import type { Change, RejectionReason } from '../_shared/shared/index.ts';

type HabitChange = Extract<Change, { table: 'habits' }>;

export type Outcome = { applied: true } | { applied: false; reason: RejectionReason };

/**
 * Applies one habit change, or keeps the server's row when that wins. When the server's row
 * wins, it is re-stamped (a no-op update takes a new server_seq), so the phone that sent the
 * losing change pulls the winning version on this same sync.
 */
export async function pushHabit(
  sql: TransactionSql,
  userId: string,
  change: HabitChange,
): Promise<Outcome> {
  const [current] = await sql`
    select user_id, client_updated_at, deleted_at
    from public.habits where id = ${change.id}`;
  // A UUID taken by another player's habit is refused, never overwritten.
  if (current && current.user_id !== userId) return { applied: false, reason: 'invalid' };

  const incomingAt = new Date(change.client_updated_at);
  const incomingDeletes = change.data.deleted_at !== null;
  const serverWins =
    current !== undefined &&
    !incomingDeletes &&
    (current.deleted_at !== null || incomingAt < (current.client_updated_at as Date));

  if (serverWins) {
    await sql`update public.habits set id = id where id = ${change.id}`;
    return { applied: true };
  }

  const d = change.data;
  await sql`
    insert into public.habits (
      id, user_id, name, type, difficulty, category, weekdays, reminder_time, sort_order,
      created_date, archived_at, deleted_at, client_updated_at
    ) values (
      ${change.id}, ${userId}, ${d.name}, ${d.type}, ${d.difficulty}, ${d.category},
      ${d.weekdays}, ${d.reminder_time}, ${d.sort_order}, ${d.created_date}, ${d.archived_at},
      ${d.deleted_at}, ${change.client_updated_at}
    )
    on conflict (id) do update set
      name = excluded.name, type = excluded.type, difficulty = excluded.difficulty,
      category = excluded.category, weekdays = excluded.weekdays,
      reminder_time = excluded.reminder_time, sort_order = excluded.sort_order,
      archived_at = excluded.archived_at,
      -- A tombstone, once set, stays: its time is the first delete's.
      deleted_at = coalesce(public.habits.deleted_at, excluded.deleted_at),
      client_updated_at = excluded.client_updated_at`;
  return { applied: true };
}
