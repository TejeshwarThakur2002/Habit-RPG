// The nightly job's party work (SCOPE.md sections 9.2 and 9.3; D59): the boss's hits in the
// battle log for missed quests, a new boss each Monday in the party's time zone, and removing
// parties that have stood empty for a week. Every step is safe to run twice or late.

import type { Sql, TransactionSql } from 'postgres';

import {
  addDays,
  bossMaxHp,
  nextBoss,
  weekStart,
  type BossKey,
  type LocalDate,
  type MissedHabit,
} from '../_shared/game-core/index.ts';

/**
 * After closing a player's days: one `boss_attack` line per missed quest that cost HP, against
 * the boss whose week holds that day. Narration only, the HP was taken by the day close. Runs in
 * the same transaction, for days closed just now, so a day is narrated once (D59).
 */
export async function bossAttacks(sql: TransactionSql, userId: string, dates: LocalDate[]) {
  if (dates.length === 0) return;
  const [member] = await sql`
    select party_id from public.party_members where user_id = ${userId} and left_at is null`;
  if (!member) return;
  for (const date of dates) {
    const [boss] = await sql`
      select id from public.boss_weeks
      where party_id = ${member.party_id}
        and week_start <= ${date} and week_start > ${addDays(date, -7)}`;
    const [closure] = await sql`
      select missed from public.day_closures where user_id = ${userId} and local_date = ${date}`;
    if (!boss || !closure) continue;
    for (const miss of closure.missed as MissedHabit[]) {
      // A miss the gear blocked did no harm, so the boss landed no hit.
      if (miss.blocked || miss.hpLoss === 0) continue;
      await sql`
        insert into public.party_events (party_id, boss_week_id, user_id, kind, amount, habit_name)
        select ${member.party_id}, ${boss.id}, ${userId}, 'boss_attack', ${miss.hpLoss}, name
        from public.habits where id = ${miss.habitId}`;
    }
  }
}

/**
 * Starts this week's boss for every party whose Monday 00:00 has passed in its time zone and
 * that has none yet: the next boss in the roster, with HP for the members active now (section
 * 3). A party with nobody in it gets none. After an outage only the current week starts.
 */
export async function rolloverBosses(sql: Sql, now: Date): Promise<number> {
  const parties = await sql`
    select p.id, p.timezone,
      (select count(*)::int from public.party_members m
        where m.party_id = p.id and m.left_at is null) as active,
      (select b.week_start::text from public.boss_weeks b
        where b.party_id = p.id order by b.week_start desc limit 1) as last_start,
      (select b.boss_key from public.boss_weeks b
        where b.party_id = p.id order by b.week_start desc limit 1) as last_boss
    from public.parties p`;
  let started = 0;
  for (const party of parties) {
    const thisWeek = weekStart(now.getTime(), party.timezone as string);
    if (party.active === 0 || (party.last_start !== null && party.last_start >= thisWeek)) continue;
    const hp = bossMaxHp(party.active as number);
    const inserted = await sql`
      insert into public.boss_weeks (party_id, week_start, boss_key, max_hp, current_hp)
      values (${party.id}, ${thisWeek}, ${nextBoss(party.last_boss as BossKey | null)}, ${hp}, ${hp})
      on conflict (party_id, week_start) do nothing
      returning id`;
    started += inserted.length;
  }
  return started;
}

/** A party whose last member left over 7 days ago goes, with its bosses and log (section 9.2). */
export async function removeEmptyParties(sql: Sql, now: Date): Promise<number> {
  const removed = await sql`
    delete from public.parties p
    where not exists (
        select 1 from public.party_members m where m.party_id = p.id and m.left_at is null)
      and (select max(m.left_at) from public.party_members m where m.party_id = p.id)
        < ${now}::timestamptz - interval '7 days'
    returning p.id`;
  return removed.length;
}
