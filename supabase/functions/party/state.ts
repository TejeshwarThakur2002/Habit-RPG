// The party snapshot every action answers with (D56, D57): the party, its members with this
// week's damage, the current boss and the latest battle-log lines. Read with the service
// connection, so it must only ever be built for a member of the party.

import type { TransactionSql } from 'postgres';

import { daysLeftInWeek, localDate } from '../_shared/game-core/index.ts';
import type { PartyState } from '../_shared/shared/index.ts';

const iso = (value: Date | null) => (value === null ? null : value.toISOString());

/** The account's active party, if any. */
export async function activePartyId(sql: TransactionSql, userId: string): Promise<string | null> {
  const [row] = await sql`
    select party_id from public.party_members where user_id = ${userId} and left_at is null`;
  return row ? (row.party_id as string) : null;
}

async function currentBoss(sql: TransactionSql, partyId: string, timeZone: string, now: Date) {
  // The latest week: until the hourly rollover runs on Monday, last week's boss stays up.
  const [boss] = await sql`
    select *, week_start::text as week_start from public.boss_weeks
    where party_id = ${partyId} order by boss_weeks.week_start desc limit 1`;
  if (!boss) return null;
  return {
    id: boss.id as string,
    boss_key: boss.boss_key,
    week_start: boss.week_start as string,
    max_hp: boss.max_hp as number,
    current_hp: boss.current_hp as number,
    defeated_at: iso(boss.defeated_at as Date | null),
    days_left: daysLeftInWeek(localDate(now.getTime(), timeZone)),
  };
}

/**
 * Active members, and anyone who left after hitting this week's boss, so their damage stays
 * visible until the week rolls over (D57). Damage is net of undone completions.
 */
async function members(sql: TransactionSql, partyId: string, bossId: string | null) {
  const rows = await sql`
    select m.user_id, m.left_at is null as active, p.hero_name, p.class,
      coalesce(sum(case e.kind when 'damage' then e.amount when 'undo' then -e.amount end), 0)::int
        as damage
    from public.party_members m
    left join public.profiles p on p.id = m.user_id
    left join public.party_events e
      on e.party_id = m.party_id and e.user_id = m.user_id
      and e.boss_week_id = ${bossId} and e.kind in ('damage', 'undo')
    where m.party_id = ${partyId}
    group by m.user_id, m.left_at, p.hero_name, p.class`;
  return rows
    .filter((r) => r.active || r.damage > 0)
    .map((r) => ({
      user_id: r.user_id as string,
      hero_name: (r.hero_name as string | null) ?? null,
      class: r.class ?? null,
      active: r.active as boolean,
      damage: Math.max(0, r.damage as number),
    }))
    .sort((a, b) => b.damage - a.damage);
}

export async function partyState(
  sql: TransactionSql,
  userId: string,
  now: Date,
): Promise<PartyState> {
  const partyId = await activePartyId(sql, userId);
  if (partyId === null) return { party: null };
  const [party] = await sql`select * from public.parties where id = ${partyId}`;
  const boss = await currentBoss(sql, partyId, party!.timezone as string, now);
  const events = await sql`
    select * from public.party_events where party_id = ${partyId}
    order by created_at desc, id desc limit 20`;
  const [claim] = boss
    ? await sql`select 1 from public.boss_claims where boss_week_id = ${boss.id} and user_id = ${userId}`
    : [];
  return {
    party: {
      id: partyId,
      name: party!.name as string,
      code: party!.code as string,
      timezone: party!.timezone as string,
      members: await members(sql, partyId, boss?.id ?? null),
      boss,
      events: events.map((e) => ({
        id: e.id as string,
        kind: e.kind,
        user_id: (e.user_id as string | null) ?? null,
        amount: (e.amount as number | null) ?? null,
        habit_name: (e.habit_name as string | null) ?? null,
        created_at: (e.created_at as Date).toISOString(),
      })),
      claimed: claim !== undefined,
    },
  };
}
