// Pushing (SCOPE.md section 8.3), one change at a time in the order the phone made them. The
// profile also creates the server hero on the first sync. Gear and profile edits follow (D35).

import type { TransactionSql } from 'postgres';

import { newHero } from '../_shared/game-core/index.ts';
import type { Change, SyncResponse } from '../_shared/shared/index.ts';
import { pushCompletion } from './push-completions.ts';
import { pushHabit, type Outcome } from './push-habits.ts';

export interface PushResult {
  applied: string[];
  rejected: SyncResponse['rejected'];
}

const SUPPORTED = new Set(['profiles', 'habits', 'completions']);

/** A request carrying a change this version can't apply yet is refused as a whole. */
export class UnsupportedChangeError extends Error {
  constructor(readonly table: string) {
    super(`Changes to ${table} are not supported yet`);
  }
}

export function assertSupported(changes: readonly Change[]): void {
  const other = changes.find((c) => !SUPPORTED.has(c.table));
  if (other) throw new UnsupportedChangeError(other.table);
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

export async function pushChanges(
  sql: TransactionSql,
  userId: string,
  changes: readonly Change[],
  now: Date,
): Promise<PushResult> {
  const result: PushResult = { applied: [], rejected: [] };
  for (const change of changes) {
    let outcome: Outcome;
    if (change.table === 'profiles') {
      await applyProfile(sql, userId, change);
      outcome = { applied: true };
    } else if (change.table === 'habits') {
      outcome = await pushHabitChange(sql, userId, change);
    } else if (change.table === 'completions') {
      outcome = await pushCompletion(sql, userId, change, now);
    } else {
      continue;
    }
    if (outcome.applied) result.applied.push(change.id);
    else result.rejected.push({ id: change.id, table: change.table, reason: outcome.reason });
  }
  return result;
}
