// Pushing (SCOPE.md section 8.3), one change at a time in the order the phone made them. The
// profile also creates the server hero on the first sync. An import replays history (D42).

import type { TransactionSql } from 'postgres';

import { newHero } from '../_shared/game-core/index.ts';
import type { Change, SyncResponse } from '../_shared/shared/index.ts';
import { closeDays } from '../_server/close-days.ts';
import { beginImport, changeTime, type ImportRequest } from './import.ts';
import { pushCompletion } from './push-completions.ts';
import { pushHabit, type Outcome } from './push-habits.ts';
import { pushInventory } from './push-inventory.ts';

export interface PushResult {
  applied: string[];
  rejected: SyncResponse['rejected'];
}

type ProfileChange = Extract<Change, { table: 'profiles' }>;

/**
 * The profile row is the player's id, name, class and time zone. The first one also creates
 * the hero, from game-core's new-hero values; after that the hero is only ever changed by the
 * server's own rules.
 */
async function applyProfile(
  sql: TransactionSql,
  userId: string,
  change: ProfileChange,
): Promise<void> {
  const { hero_name, class: heroClass, timezone } = change.data;
  await sql`
    insert into public.profiles (id, hero_name, class, timezone)
    values (${userId}, ${hero_name}, ${heroClass}, ${timezone})
    on conflict (id) do update
      set hero_name = excluded.hero_name, class = excluded.class, timezone = excluded.timezone`;
  const hero = newHero();
  await sql`
    insert into public.characters (user_id, level, xp_in_level, hp, gold)
    values (${userId}, ${hero.level}, ${hero.xpInLevel}, ${hero.hp}, ${hero.gold})
    on conflict (user_id) do nothing`;
}

/** Habits belong to a profile: a phone always pushes its profile first. */
async function pushHabitChange(
  sql: TransactionSql,
  userId: string,
  change: Extract<Change, { table: 'habits' }>,
): Promise<Outcome> {
  const [profile] = await sql`select 1 from public.profiles where id = ${userId}`;
  if (!profile) return { applied: false, reason: 'invalid' };
  return await pushHabit(sql, userId, change);
}

/**
 * In an import, a change that moves the hero is applied as of when it happened on the phone:
 * the days that had ended by then are closed first, and the completion window is measured
 * from that time. Nothing may be dated after the server's now.
 */
async function pushTimed(
  sql: TransactionSql,
  userId: string,
  change: Change,
  now: Date,
): Promise<Outcome | Date> {
  const at = changeTime(change);
  if (at === null) return now;
  const when = new Date(at);
  if (when > now) {
    return {
      applied: false,
      reason: change.table === 'completions' ? 'date_out_of_range' : 'invalid',
    };
  }
  await closeDays(sql, userId, when);
  return when;
}

async function pushChange(
  sql: TransactionSql,
  userId: string,
  change: Change,
  serverNow: Date,
  imported: ImportRequest | undefined,
): Promise<Outcome> {
  let now = serverNow;
  if (imported) {
    const timed = await pushTimed(sql, userId, change, serverNow);
    if (!(timed instanceof Date)) return timed;
    now = timed;
  }
  switch (change.table) {
    case 'profiles':
      await applyProfile(sql, userId, change);
      if (imported) await beginImport(sql, userId, imported);
      return { applied: true };
    case 'habits':
      return await pushHabitChange(sql, userId, change);
    case 'completions':
      return await pushCompletion(sql, userId, change, now);
    case 'inventory':
      return await pushInventory(sql, userId, change);
  }
}

export async function pushChanges(
  sql: TransactionSql,
  userId: string,
  changes: readonly Change[],
  now: Date,
  imported?: ImportRequest,
): Promise<PushResult> {
  const result: PushResult = { applied: [], rejected: [] };
  for (const change of changes) {
    const outcome = await pushChange(sql, userId, change, now, imported);
    if (outcome.applied) result.applied.push(change.id);
    else result.rejected.push({ id: change.id, table: change.table, reason: outcome.reason });
  }
  return result;
}
