// Creating, joining and leaving a party (SCOPE.md section 9.2; D57). Each runs in one
// transaction. The user id comes only from the token.

import type { TransactionSql } from 'postgres';

import {
  MAX_PARTY_SIZE,
  bossMaxHp,
  generatePartyCode,
  nextBoss,
  weekStart,
} from '../_shared/game-core/index.ts';
import type { PartyRefusal } from '../_shared/shared/index.ts';
import { activePartyId } from './state.ts';

/** An action the rules don't allow, answered with this status and code. */
export class PartyRefusedError extends Error {
  constructor(
    readonly status: number,
    readonly code: PartyRefusal,
  ) {
    super(code);
  }
}

const randomIndex = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % n;

/** A party needs the player's hero to show, and the creator's time zone sets its week. */
async function heroOf(sql: TransactionSql, userId: string) {
  const [profile] = await sql`select timezone from public.profiles where id = ${userId}`;
  if (!profile) throw new PartyRefusedError(409, 'no_hero');
  return profile as { timezone: string };
}

async function notInParty(sql: TransactionSql, userId: string) {
  if ((await activePartyId(sql, userId)) !== null) {
    throw new PartyRefusedError(409, 'already_in_party');
  }
}

export async function createParty(sql: TransactionSql, userId: string, name: string, now: Date) {
  const { timezone } = await heroOf(sql, userId);
  await notInParty(sql, userId);
  // 32^6 codes: a clash is rare, and a few tries make it vanishingly so.
  let partyId: string | undefined;
  for (let attempt = 0; attempt < 5 && partyId === undefined; attempt++) {
    const [row] = await sql`
      insert into public.parties (name, code, creator_id, timezone)
      values (${name}, ${generatePartyCode(randomIndex)}, ${userId}, ${timezone})
      on conflict (code) do nothing returning id`;
    partyId = row?.id as string | undefined;
  }
  if (partyId === undefined) throw new Error('Could not find a free party code');
  await sql`insert into public.party_members (party_id, user_id) values (${partyId}, ${userId})`;
  // The first week's boss, with HP for the one member who is there at the start (section 3).
  await sql`
    insert into public.boss_weeks (party_id, week_start, boss_key, max_hp, current_hp)
    values (${partyId}, ${weekStart(now.getTime(), timezone)}, ${nextBoss(null)},
      ${bossMaxHp(1)}, ${bossMaxHp(1)})`;
  await sql`
    insert into public.party_events (party_id, user_id, kind) values (${partyId}, ${userId}, 'join')`;
}

export async function joinParty(sql: TransactionSql, userId: string, code: string) {
  await heroOf(sql, userId);
  await notInParty(sql, userId);
  // Locked so two players joining at once can't make a fifth member.
  const [party] = await sql`select id from public.parties where code = ${code} for update`;
  if (!party) throw new PartyRefusedError(404, 'not_found');
  const [{ active }] = await sql`
    select count(*)::int as active from public.party_members
    where party_id = ${party.id} and left_at is null`;
  if (active >= MAX_PARTY_SIZE) throw new PartyRefusedError(409, 'party_full');
  // A player who left may come back: their row opens again (D57).
  await sql`
    insert into public.party_members (party_id, user_id) values (${party.id}, ${userId})
    on conflict (party_id, user_id) do update set left_at = null, joined_at = now()`;
  await sql`
    insert into public.party_events (party_id, user_id, kind) values (${party.id}, ${userId}, 'join')`;
}

/** Past damage stays on the boss; the player stops appearing from next week (F7). */
export async function leaveParty(sql: TransactionSql, userId: string) {
  const partyId = await activePartyId(sql, userId);
  if (partyId === null) throw new PartyRefusedError(409, 'not_in_party');
  await sql`
    update public.party_members set left_at = now()
    where party_id = ${partyId} and user_id = ${userId}`;
  await sql`
    insert into public.party_events (party_id, user_id, kind) values (${partyId}, ${userId}, 'leave')`;
}
