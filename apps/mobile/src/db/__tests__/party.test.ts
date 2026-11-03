import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PartyState } from '@habit-rpg/shared';
import initSqlJs from 'sql.js';

import { createTestDb, createTestDbWithClient } from '../../test/test-db';
import { getPartyView, saveParty } from '../queries/party';
import * as t from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';

// Wednesday 28 October 2026, 12:00 in Toronto; Sunday 1 November is the party week's last day.
const NOW = Date.parse('2026-10-28T16:00:00Z');
const ME = '00000000-0000-4000-8000-00000000000a';
const RAVI = '00000000-0000-4000-8000-00000000000b';
const GONE = '00000000-0000-4000-8000-00000000000c';
const PARTY = '00000000-0000-4000-8000-0000000000f1';
const BOSS = '00000000-0000-4000-8000-0000000000b1';

function snapshot(overrides: Partial<NonNullable<PartyState['party']>> = {}): PartyState {
  return {
    party: {
      id: PARTY,
      name: 'Night Owls',
      code: 'K7M2QX',
      timezone: 'America/Toronto',
      members: [
        { user_id: ME, hero_name: 'Ada', class: 'knight', active: true, damage: 20 },
        { user_id: RAVI, hero_name: 'Ravi', class: 'mage', active: true, damage: 45 },
        { user_id: GONE, hero_name: null, class: null, active: false, damage: 10 },
      ],
      boss: {
        id: BOSS,
        boss_key: 'procrastination-slime',
        week_start: '2026-10-26',
        max_hp: 1500,
        current_hp: 1425,
        defeated_at: null,
        days_left: 5,
      },
      events: [
        {
          id: '00000000-0000-4000-8000-0000000000e1',
          kind: 'damage',
          boss_week_id: BOSS,
          user_id: ME,
          amount: 20,
          habit_name: 'Read',
          created_at: '2026-10-28T15:00:00.000Z',
        },
      ],
      claimed: true,
      ...overrides,
    },
  };
}

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
});

describe('saveParty and getPartyView', () => {
  it('stores the snapshot with the player as `local`, members by damage', () => {
    saveParty(db, snapshot(), ME, NOW);
    const view = getPartyView(db, NOW)!;
    expect(view).toMatchObject({ name: 'Night Owls', code: 'K7M2QX' });
    expect(view.fetchedAt).toBe(new Date(NOW).toISOString());
    expect(view.members.map((m) => [m.name, m.isYou, m.active, m.damage])).toEqual([
      ['Ravi', false, true, 45],
      ['Ada', true, true, 20],
      [null, false, false, 10],
    ]);
    expect(view.boss).toMatchObject({ currentHp: 1425, claimed: true, defeated: false });
    expect(db.select().from(t.partyEvents).get()?.userId).toBe(LOCAL_USER_ID);
  });

  it("counts days left in the party's own time zone", () => {
    saveParty(db, snapshot(), ME, NOW);
    expect(getPartyView(db, NOW)?.boss?.daysLeft).toBe(5);
    // Sunday 23:30 in Toronto is already Monday in UTC; still the last day there.
    expect(getPartyView(db, Date.parse('2026-11-02T04:30:00Z'))?.boss?.daysLeft).toBe(1);
    // Monday 9 November: the stored boss is last week's, so there is no count to show.
    expect(getPartyView(db, Date.parse('2026-11-09T16:00:00Z'))?.boss?.daysLeft).toBeNull();
  });

  it('reads the battle log newest first, at most 20, the player as `local`', () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
      kind: 'damage' as const,
      boss_week_id: BOSS,
      user_id: i % 2 ? ME : RAVI,
      amount: 10,
      habit_name: 'Read',
      created_at: new Date(NOW - (20 - i) * 60_000).toISOString(),
    }));
    saveParty(db, snapshot({ events }), ME, NOW);
    const log = getPartyView(db, NOW)!.events;
    expect(log).toHaveLength(20);
    expect(log[0]).toMatchObject({ id: events[19]!.id, userId: LOCAL_USER_ID, bossWeekId: BOSS });
    expect(log[19]?.id).toBe(events[0]!.id);
    expect(getPartyView(db, NOW)).toMatchObject({
      timezone: 'America/Toronto',
      boss: { weekStart: '2026-10-26' },
    });
  });

  it('replaces the previous party, and clears it on leaving', () => {
    saveParty(db, snapshot(), ME, NOW);
    saveParty(db, snapshot({ name: 'Larks', members: [], events: [], boss: null }), ME, NOW);
    expect(getPartyView(db, NOW)).toMatchObject({ name: 'Larks', members: [], boss: null });
    saveParty(db, { party: null }, ME, NOW);
    expect(getPartyView(db, NOW)).toBeNull();
    expect(db.select().from(t.partyMembers).all()).toEqual([]);
    expect(db.select().from(t.bossWeeks).all()).toEqual([]);
  });
  it('tells the screens when leaving empties the party', async () => {
    const { db, client } = await createTestDbWithClient();
    saveParty(db, snapshot(), ME, NOW);
    const changed: string[] = [];
    client.updateHook((_op, _db, table) => changed.push(table));
    saveParty(db, { party: null }, ME, NOW);
    expect(changed).toContain('parties');
  });
});

describe('migration 0005', () => {
  it('keeps the party rows already on the phone, with no damage yet', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const folder = path.join(__dirname, '..', 'migrations');
    const journal = JSON.parse(
      readFileSync(path.join(folder, 'meta', '_journal.json'), 'utf8'),
    ) as {
      entries: { tag: string }[];
    };
    const apply = (tag: string) =>
      readFileSync(path.join(folder, `${tag}.sql`), 'utf8')
        .split('--> statement-breakpoint')
        .forEach((statement) => raw.run(statement));
    const tags = journal.entries.map((e) => e.tag);
    tags.slice(0, tags.indexOf('0005_party_snapshot')).forEach(apply);
    raw.run(`insert into parties (id, name, code, timezone) values ('p', 'Owls', 'K7M2QX', 'UTC')`);
    raw.run(`insert into party_members (party_id, user_id, hero_name, class, joined_at)
             values ('p', 'local', 'Ada', 'knight', '2026-10-01')`);
    raw.run(`insert into boss_weeks (id, party_id, week_start, boss_key, max_hp, current_hp)
             values ('b', 'p', '2026-10-26', 'procrastination-slime', 500, 400)`);

    apply('0005_party_snapshot');

    expect(raw.exec('select hero_name, damage from party_members')[0]?.values).toEqual([
      ['Ada', 0],
    ]);
    expect(raw.exec('select claimed from boss_weeks')[0]?.values).toEqual([[0]]);
    expect(raw.exec('select fetched_at from parties')[0]?.values).toEqual([[null]]);
  });
});
