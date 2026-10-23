// Pushing (SCOPE.md section 8.3). This first version applies the profile, which also creates
// the server hero on the first sync; habits, completions and gear follow (D35, PRs C and D).

import type { TransactionSql } from 'postgres';

import { newHero } from '../_shared/game-core/index.ts';
import type { Change } from '../_shared/shared/index.ts';

export interface PushResult {
  applied: string[];
}

/** A request carrying a change this version can't apply yet is refused as a whole. */
export class UnsupportedChangeError extends Error {
  constructor(readonly table: string) {
    super(`Changes to ${table} are not supported yet`);
  }
}

export function assertSupported(changes: readonly Change[]): void {
  const other = changes.find((c) => c.table !== 'profiles');
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

export async function pushChanges(
  sql: TransactionSql,
  userId: string,
  changes: readonly Change[],
): Promise<PushResult> {
  const applied: string[] = [];
  for (const change of changes) {
    if (change.table === 'profiles') {
      await applyProfile(sql, userId, change);
      applied.push(change.id);
    }
  }
  return { applied };
}
