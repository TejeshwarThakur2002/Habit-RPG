// The party on the phone (SCOPE.md sections 5.5 and 8.2; D56, D60): the server's snapshot,
// stored in the party read-model tables so the Party tab reads SQLite like every screen, and
// works offline with what it last saw.

import type { PartyState } from '@habit-rpg/shared';
import { daysLeftInWeek, localDate, type BossKey, type HeroClass } from '@habit-rpg/game-core';
import { desc, eq, sql } from 'drizzle-orm';

import * as t from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Replaces the stored party with the snapshot, in one transaction. The server names the player
 * by their account id; the phone keys its own rows `local`, as everywhere else.
 */
export function saveParty(db: AppDb, state: PartyState, accountUserId: string, now: number): void {
  const local = (id: string | null) => (id === accountUserId ? LOCAL_USER_ID : id);
  db.transaction((tx) => {
    // A DELETE with no WHERE takes SQLite's truncate shortcut, which skips the change listener
    // the screens repaint on; leaving a party writes nothing else, so the tab would never update.
    const everyRow = sql`1`;
    tx.delete(t.partyEvents).where(everyRow).run();
    tx.delete(t.bossWeeks).where(everyRow).run();
    tx.delete(t.partyMembers).where(everyRow).run();
    tx.delete(t.parties).where(everyRow).run();
    const party = state.party;
    if (party === null) return;
    tx.insert(t.parties)
      .values({
        id: party.id,
        name: party.name,
        code: party.code,
        timezone: party.timezone,
        fetchedAt: iso(now),
      })
      .run();
    for (const m of party.members) {
      tx.insert(t.partyMembers)
        .values({
          partyId: party.id,
          userId: local(m.user_id)!,
          heroName: m.hero_name,
          heroClass: m.class,
          // The snapshot has no join time; members are ordered by damage.
          joinedAt: iso(now),
          leftAt: m.active ? null : iso(now),
          damage: m.damage,
        })
        .run();
    }
    if (party.boss) {
      const b = party.boss;
      tx.insert(t.bossWeeks)
        .values({
          id: b.id,
          partyId: party.id,
          weekStart: b.week_start,
          bossKey: b.boss_key,
          maxHp: b.max_hp,
          currentHp: b.current_hp,
          defeatedAt: b.defeated_at,
          claimed: party.claimed,
        })
        .run();
    }
    for (const e of party.events) {
      tx.insert(t.partyEvents)
        .values({
          id: e.id,
          partyId: party.id,
          bossWeekId: party.boss?.id ?? null,
          userId: local(e.user_id),
          kind: e.kind,
          amount: e.amount,
          habitName: e.habit_name,
          createdAt: e.created_at,
        })
        .run();
    }
  });
}

export interface PartyMemberView {
  userId: string;
  /** Null for a hero that no longer exists. */
  name: string | null;
  heroClass: HeroClass | null;
  isYou: boolean;
  active: boolean;
  damage: number;
}

export interface PartyView {
  id: string;
  name: string;
  code: string;
  fetchedAt: string | null;
  members: PartyMemberView[];
  boss: {
    id: string;
    bossKey: BossKey;
    maxHp: number;
    currentHp: number;
    defeated: boolean;
    claimed: boolean;
    daysLeft: number;
  } | null;
}

/** The stored party for the Party tab, or null without one. Days left are in its time zone. */
export function getPartyView(db: AppDb, now: number): PartyView | null {
  const party = db.select().from(t.parties).get();
  if (!party) return null;
  const members = db
    .select()
    .from(t.partyMembers)
    .where(eq(t.partyMembers.partyId, party.id))
    .orderBy(desc(t.partyMembers.damage))
    .all()
    .map((m) => ({
      userId: m.userId,
      name: m.heroName,
      heroClass: m.heroClass,
      isYou: m.userId === LOCAL_USER_ID,
      active: m.leftAt === null,
      damage: m.damage,
    }));
  const boss = db
    .select()
    .from(t.bossWeeks)
    .where(eq(t.bossWeeks.partyId, party.id))
    .orderBy(desc(t.bossWeeks.weekStart))
    .get();
  return {
    id: party.id,
    name: party.name,
    code: party.code,
    fetchedAt: party.fetchedAt,
    members,
    boss: boss
      ? {
          id: boss.id,
          bossKey: boss.bossKey,
          maxHp: boss.maxHp,
          currentHp: boss.currentHp,
          defeated: boss.defeatedAt !== null,
          claimed: boss.claimed,
          daysLeft: daysLeftInWeek(localDate(now, party.timezone)),
        }
      : null,
  };
}
