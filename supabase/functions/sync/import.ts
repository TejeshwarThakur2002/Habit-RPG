// Importing a linked local hero (DECISIONS.md D35, D42). An account with no server hero may
// send its phone's history once, in time order, over several requests. The server replays it
// with its own rules: before each timed change it closes the days that had ended by then, so
// rewards, HP losses, faints and streaks fall where they did on the phone, and the result is
// worked out by the server rather than taken from the phone.

import type { TransactionSql } from 'postgres';

import type { Change, SyncRequest } from '../_shared/shared/index.ts';
import { closeDays } from '../_server/close-days.ts';

/** A sync the server won't run at all, answered with this status and code. */
export class SyncRefusedError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'hero_exists' | 'import_in_progress' | 'bad_import',
  ) {
    super(code);
  }
}

/**
 * An import only reaches an account with no hero, or one whose import is still running; an
 * ordinary sync waits until the import is done. A start time in the future is refused.
 */
export async function checkImport(
  sql: TransactionSql,
  userId: string,
  request: SyncRequest,
  now: Date,
): Promise<void> {
  const [hero] = await sql`select importing from public.characters where user_id = ${userId}`;
  if (!request.import) {
    if (hero?.importing) throw new SyncRefusedError(409, 'import_in_progress');
    return;
  }
  // The phone asks which hero to keep when the account already has one (D34, P4).
  if (hero && !hero.importing) throw new SyncRefusedError(409, 'hero_exists');
  if (new Date(request.import.started_at) > now) throw new SyncRefusedError(400, 'bad_import');
}

/**
 * The import's profile has just made the hero: mark it as importing, and date the profile
 * back to when the hero was made on the phone, so day close starts from that day.
 */
export async function beginImport(sql: TransactionSql, userId: string, startedAt: string) {
  await sql`
    update public.profiles set created_at = ${startedAt}
    where id = ${userId} and created_at > ${startedAt}`;
  await sql`update public.characters set importing = true where user_id = ${userId}`;
}

/** When a change happened on the phone, for the changes that move the hero. */
export function changeTime(change: Change): string | null {
  if (change.table === 'completions') return change.data.completed_at;
  if (change.table === 'inventory') return change.client_updated_at;
  return null;
}

/** The last request: close every day up to now and let ordinary syncs in. */
export async function finishImport(sql: TransactionSql, userId: string, now: Date) {
  await closeDays(sql, userId, now);
  await sql`update public.characters set importing = false where user_id = ${userId}`;
}
