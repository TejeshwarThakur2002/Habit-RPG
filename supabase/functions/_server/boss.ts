// Boss damage on sync (SCOPE.md section 9.4; D58). A completion from a player in a party hits
// the party's current boss in the same transaction, with the boss row locked so two members
// finishing at once can't corrupt its HP. An undone completion gives back what it dealt.

import type { TransactionSql } from 'postgres';

import { addDays, applyBossDamage, undoBossDamage } from '../_shared/game-core/index.ts';

export interface Hit {
  completionId: string;
  localDate: string;
  damage: number;
  habitId: string;
}

/** The player's party's latest boss, locked until the transaction ends. */
async function lockCurrentBoss(sql: TransactionSql, partyId: string) {
  const [boss] = await sql`
    select id, max_hp, current_hp, week_start::text as starts
    from public.boss_weeks where party_id = ${partyId}
    order by boss_weeks.week_start desc limit 1 for update`;
  return boss as { id: string; max_hp: number; current_hp: number; starts: string } | undefined;
}

/** Hits the boss, once per completion; only completions dated in its week count (D56). */
export async function hitBoss(sql: TransactionSql, userId: string, hit: Hit): Promise<void> {
  const [member] = await sql`
    select party_id from public.party_members where user_id = ${userId} and left_at is null`;
  if (!member) return;
  const boss = await lockCurrentBoss(sql, member.party_id);
  if (!boss || boss.current_hp === 0) return;
  if (hit.localDate < boss.starts || hit.localDate > addDays(boss.starts, 6)) return;

  const { hp, defeatedNow } = applyBossDamage(boss.current_hp, hit.damage);
  const [habit] = await sql`select name from public.habits where id = ${hit.habitId}`;
  // What was really dealt, so an undo gives back no more than that.
  const inserted = await sql`
    insert into public.party_events
      (party_id, boss_week_id, user_id, kind, amount, habit_name, completion_id)
    values (${member.party_id}, ${boss.id}, ${userId}, 'damage', ${boss.current_hp - hp},
      ${habit?.name ?? null}, ${hit.completionId})
    on conflict (completion_id, kind) where completion_id is not null do nothing
    returning id`;
  if (inserted.length === 0) return;
  await sql`
    update public.boss_weeks
    set current_hp = ${hp}, defeated_at = case when ${defeatedNow} then now() else defeated_at end
    where id = ${boss.id}`;
  if (defeatedNow) {
    // now() is the transaction's start, the same as the hit's; the clock puts the victory after.
    await sql`
      insert into public.party_events (party_id, boss_week_id, user_id, kind, created_at)
      values (${member.party_id}, ${boss.id}, ${userId}, 'victory', clock_timestamp())`;
  }
}

/**
 * An undone completion gives its damage back, once. A defeated boss stays defeated (game-core),
 * so a victory and its rewards can't be taken away.
 */
export async function healBoss(sql: TransactionSql, completionId: string): Promise<void> {
  const [dealt] = await sql`
    select party_id, boss_week_id, user_id, amount from public.party_events
    where completion_id = ${completionId} and kind = 'damage'`;
  if (!dealt) return;
  const [boss] = await sql`
    select max_hp, current_hp from public.boss_weeks where id = ${dealt.boss_week_id} for update`;
  if (!boss) return;
  const hp = undoBossDamage(boss.current_hp, boss.max_hp, dealt.amount);
  const inserted = await sql`
    insert into public.party_events
      (party_id, boss_week_id, user_id, kind, amount, completion_id)
    values (${dealt.party_id}, ${dealt.boss_week_id}, ${dealt.user_id}, 'undo',
      ${hp - boss.current_hp}, ${completionId})
    on conflict (completion_id, kind) where completion_id is not null do nothing
    returning id`;
  if (inserted.length === 0) return;
  await sql`update public.boss_weeks set current_hp = ${hp} where id = ${dealt.boss_week_id}`;
}
