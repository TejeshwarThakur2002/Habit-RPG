// The server's hero (SCOPE.md section 8.3, "Authoritative hero"). Every change goes through
// `changeHero`, which records how it moved total XP, gold and HP in character_events (once,
// by kind and ref) and only then stores the new hero, so the log always replays to the row.

import type { TransactionSql } from 'postgres';

import {
  gearBonuses,
  heroDelta,
  heroStats,
  type Category,
  type GearBonuses,
  type GearId,
  type Hero,
  type HeroStats,
} from '../_shared/game-core/index.ts';

export interface HeroState {
  hero: Hero;
  currentStreak: number;
  longestStreak: number;
  lastClosedDate: string | null;
}

export async function loadHero(sql: TransactionSql, userId: string): Promise<HeroState | null> {
  const [row] = await sql`
    select level, xp_in_level, hp, gold, current_streak, longest_streak,
           last_closed_date::text as last_closed_date
    from public.characters where user_id = ${userId}`;
  if (!row) return null;
  return {
    hero: { level: row.level, xpInLevel: row.xp_in_level, hp: row.hp, gold: row.gold },
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastClosedDate: row.last_closed_date,
  };
}

/** Stats from the server's own rows: active completions per category, streak and gear. */
export async function loadStats(
  sql: TransactionSql,
  userId: string,
  longestStreak: number,
): Promise<{ stats: HeroStats; gear: GearBonuses }> {
  const counts = await sql`
    select category, count(*)::int as n from public.completions
    where user_id = ${userId} and undone_at is null group by category`;
  const equipped = await sql`
    select item_id from public.inventory where user_id = ${userId} and equipped`;
  const items = equipped.map((r) => r.item_id as GearId);
  return {
    stats: heroStats({
      completionsByCategory: Object.fromEntries(counts.map((r) => [r.category as Category, r.n])),
      longestStreakDays: longestStreak,
      equipped: items,
    }),
    gear: gearBonuses(items),
  };
}

/**
 * Records an event and stores the hero it produced. The (kind, ref) key makes a retry a
 * no-op: when the event is already there, nothing changes and false comes back.
 */
export async function changeHero(
  sql: TransactionSql,
  userId: string,
  event: { kind: string; ref: string },
  before: Hero,
  after: Hero,
): Promise<boolean> {
  const delta = heroDelta(before, after);
  const inserted = await sql`
    insert into public.character_events (user_id, kind, ref_id, xp_delta, gold_delta, hp_delta)
    values (${userId}, ${event.kind}, ${event.ref}, ${delta.xp}, ${delta.gold}, ${delta.hp})
    on conflict (kind, ref_id) do nothing
    returning id`;
  if (inserted.length === 0) return false;
  await sql`
    update public.characters
    set level = ${after.level}, xp_in_level = ${after.xpInLevel}, hp = ${after.hp},
        gold = ${after.gold}
    where user_id = ${userId}`;
  return true;
}
