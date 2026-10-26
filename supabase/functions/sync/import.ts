// Importing a linked local hero (DECISIONS.md D35, D42). An account with no server hero may
// send its phone's history once, in time order, over several requests. The server replays it
// with its own rules: before each timed change it closes the days that had ended by then, so
// rewards, HP losses, faints and streaks fall where they did on the phone, and the result is
// worked out by the server rather than taken from the phone. When the account already has a
// hero, the player may keep the phone's instead, and the import replaces it (D48, D49).

import type { TransactionSql } from 'postgres';

import type {
  AccountHero,
  Change,
  RefusalCode,
  SyncRefusal,
  SyncRequest,
} from '../_shared/shared/index.ts';
import { closeDays } from '../_server/close-days.ts';

/** A sync the server won't run at all, answered with this status and code. */
export class SyncRefusedError extends Error {
  constructor(
    readonly status: number,
    readonly code: RefusalCode,
    /** With `hero_exists`: the account's hero, so the phone can show what each choice keeps. */
    readonly hero?: AccountHero,
  ) {
    super(code);
  }

  get body(): SyncRefusal {
    return this.hero ? { error: this.code, hero: this.hero } : { error: this.code };
  }
}

/** An import as the push sees it: the request's import and the phone sending it. */
export type ImportRequest = NonNullable<SyncRequest['import']> & { device_id: string };

async function loadAccount(sql: TransactionSql, userId: string) {
  const [account] = await sql`
    select c.importing, c.import_device, c.level, p.hero_name, p.class, p.replaced_seq
    from public.profiles p join public.characters c on c.user_id = p.id
    where p.id = ${userId}`;
  return account;
}

/** An ordinary sync waits for a running import, and starts again after a replaced hero. */
function checkOrdinary(account: Awaited<ReturnType<typeof loadAccount>>, cursor: number) {
  // Every row of a replaced hero has a lower server_seq than replaced_seq, so a phone that
  // pulled any of them still holds that hero.
  const replaced = account?.replaced_seq == null ? 0 : Number(account.replaced_seq);
  if (cursor > 0 && cursor < replaced) throw new SyncRefusedError(409, 'hero_replaced');
  if (account?.importing) throw new SyncRefusedError(409, 'import_in_progress');
}

/**
 * Refuses a sync that can't run, before anything changes. An import only reaches an account
 * with no hero, or the import its own phone started; with `replace`, also a finished hero the
 * player chose to give up, and then this returns true. A start time in the future is refused.
 */
export async function checkImport(
  sql: TransactionSql,
  userId: string,
  request: SyncRequest,
  now: Date,
): Promise<boolean> {
  const account = await loadAccount(sql, userId);
  const imported = request.import;
  if (!imported) {
    checkOrdinary(account, request.cursor);
    return false;
  }
  if (new Date(imported.started_at) > now) throw new SyncRefusedError(400, 'bad_import');
  if (!account) return false;
  if (account.importing) {
    if (account.import_device !== request.device_id) {
      throw new SyncRefusedError(409, 'import_in_progress');
    }
    return false;
  }
  if (!imported.replace) {
    const { hero_name, class: heroClass, level } = account;
    throw new SyncRefusedError(409, 'hero_exists', { hero_name, class: heroClass, level });
  }
  // The new hero's profile comes first, so the account is never left without one.
  if (request.changes[0]?.table !== 'profiles') throw new SyncRefusedError(400, 'bad_import');
  return true;
}

/**
 * Deletes the account's game data: the profile, and through it the hero, quests, completions,
 * closed days, gear and event log. The login stays. Returns a sync_seq value drawn after every
 * old row and before every new one.
 */
export async function replaceHero(sql: TransactionSql, userId: string): Promise<number> {
  await sql`delete from public.profiles where id = ${userId}`;
  const [{ seq }] = await sql`select nextval('public.sync_seq') as seq`;
  return Number(seq);
}

/** Once the import's profile has made the new hero, it remembers where that hero began. */
export async function markReplaced(sql: TransactionSql, userId: string, seq: number) {
  await sql`update public.profiles set replaced_seq = ${seq} where id = ${userId}`;
}

/**
 * The import's profile has just made the hero: mark it as importing from this phone, and date
 * the profile back to when the hero was made on the phone, so day close starts from that day.
 */
export async function beginImport(sql: TransactionSql, userId: string, imported: ImportRequest) {
  await sql`
    update public.profiles set created_at = ${imported.started_at}
    where id = ${userId} and created_at > ${imported.started_at}`;
  await sql`
    update public.characters set importing = true, import_device = ${imported.device_id}
    where user_id = ${userId}`;
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
  await sql`
    update public.characters set importing = false, import_device = null
    where user_id = ${userId}`;
}
