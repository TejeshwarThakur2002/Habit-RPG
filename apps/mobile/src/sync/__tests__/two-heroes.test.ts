import type { ServerChange } from '@habit-rpg/shared';

import { completeHabit } from '../../db/queries/completions';
import { createHabit } from '../../db/queries/habits';
import { getCharacter, getProfile } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { getSettings, updateSettings } from '../../db/queries/settings';
import { getSyncState } from '../../db/queries/sync-state';
import { habits, outbox } from '../../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../../db/types';
import { FakeSyncServer } from '../../test/fake-sync-server';
import { createTestDb } from '../../test/test-db';
import { createSyncEngine } from '../engine';
import { runFirstSync, takeAccountHero } from '../first-sync';

// The two-heroes choice (D48, D49): this phone has Ada, the account already has Bea.

const NOW = Date.parse('2026-10-26T15:00:00Z');
const AT = '2026-10-20T12:00:00.000Z';
const user = LOCAL_USER_ID;
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const BEA_QUEST = '22222222-2222-4222-8222-222222222222';
const newId = () => crypto.randomUUID();

let db: AppDb;
let server: FakeSyncServer;
beforeEach(async () => {
  db = await createTestDb();
  server = new FakeSyncServer();
  recordSignIn(db, { id: ACCOUNT, email: 'ada@example.com' });
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'UTC', now: NOW - 86_400_000 });
  const quest = newId();
  createHabit(db, {
    userId: user,
    id: quest,
    now: NOW - 86_400_000,
    fields: {
      name: 'Read',
      type: 'daily',
      difficulty: 'easy',
      category: 'mind',
      weekdays: 127,
      reminderTime: null,
    },
  });
  completeHabit(db, { userId: user, habitId: quest, now: NOW, newId });
});

const o = () => ({ db, transport: server, appVersion: '0', newId, now: () => NOW });
const synced = () => getSyncState(db, newId).userId;
const meta = (seq: number) => ({ server_seq: seq, updated_at: AT });

/** Bea, made on another phone: a profile, a quest and one completion. */
function seedBea(): void {
  const rows: ServerChange[] = [
    {
      table: 'profiles',
      op: 'upsert',
      data: {
        id: ACCOUNT,
        hero_name: 'Bea',
        class: 'rogue',
        timezone: 'UTC',
        created_at: AT,
        ...meta(1),
      },
    },
    {
      table: 'habits',
      op: 'upsert',
      data: {
        id: BEA_QUEST,
        name: 'Run',
        type: 'daily',
        difficulty: 'hard',
        category: 'body',
        weekdays: 127,
        reminder_time: null,
        sort_order: 0,
        created_date: '2026-10-20',
        archived_at: null,
        deleted_at: null,
        client_updated_at: AT,
        ...meta(2),
      },
    },
    {
      table: 'completions',
      op: 'upsert',
      data: {
        id: newId(),
        habit_id: BEA_QUEST,
        local_date: '2026-10-21',
        completed_at: '2026-10-21T08:00:00.000Z',
        undone_at: null,
        category: 'body',
        xp_awarded: 30,
        gold_awarded: 9,
        boss_damage: 30,
        is_late: false,
        ...meta(3),
      },
    },
  ];
  rows.forEach((row) => server.seed(row));
  server.character = { ...server.character, level: 3, xp_in_level: 40, gold: 52 };
}

describe("keeping this phone's hero", () => {
  it("sends every batch of the import with replace, and the account's rows go", async () => {
    seedBea();
    expect((await runFirstSync(o(), ACCOUNT, { replace: true })).status).toBe('done');
    expect(server.requests.filter((r) => r.import).every((r) => r.import?.replace)).toBe(true);
    expect(server.stored('profiles')).toHaveLength(1);
    expect(JSON.stringify(server.stored('habits'))).not.toContain(BEA_QUEST);
    expect(getProfile(db, user)?.heroName).toBe('Ada');
    expect(synced()).toBe(ACCOUNT);
  });
});

describe("using the account's hero", () => {
  it("downloads every page, then swaps the account's hero in for the phone's", async () => {
    seedBea();
    server.pageSize = 1;
    updateSettings(db, {
      pendingFaint: { date: '2026-10-25', goldLost: 1, xpLost: 0, missed: [] },
    });

    expect(await takeAccountHero(o(), ACCOUNT)).toEqual({
      status: 'done',
      rejected: [],
      pulledHero: true,
    });
    expect(server.requests.map((r) => r.cursor)).toEqual([0, 1, 2]);
    expect(getProfile(db, user)).toMatchObject({ heroName: 'Bea', heroClass: 'rogue' });
    expect(getCharacter(db, user)).toMatchObject({ level: 3, gold: 52 });
    expect(db.select({ id: habits.id }).from(habits).all()).toEqual([{ id: BEA_QUEST }]);
    expect(db.select().from(outbox).all()).toEqual([]);
    expect(getSettings(db).pendingFaint).toBeNull();
    expect(synced()).toBe(ACCOUNT);
    expect(getSyncState(db, newId).cursor).toBe(3);
  });

  it('changes nothing on the phone when the connection drops part-way', async () => {
    seedBea();
    server.pageSize = 1;
    server.failNext('ok', 'offline');
    const queued = db.select().from(outbox).all().length;

    expect((await takeAccountHero(o(), ACCOUNT)).status).toBe('offline');
    expect(getProfile(db, user)?.heroName).toBe('Ada');
    expect(db.select().from(outbox).all()).toHaveLength(queued);
    expect(synced()).toBeNull();
  });

  it('changes nothing when the account turns out to have no hero', async () => {
    expect((await takeAccountHero(o(), ACCOUNT)).status).toBe('error');
    expect(getProfile(db, user)?.heroName).toBe('Ada');
  });
});

describe('a hero replaced from another phone', () => {
  it('is reported by the engine, and taking the account hero brings the new one', async () => {
    server.failNext('hero-replaced');
    const engine = createSyncEngine({ ...o(), setTimer: () => undefined });
    expect(await engine.syncNow()).toMatchObject({
      status: 'error',
      code: 'hero_replaced',
      retryInMs: null,
    });

    seedBea();
    await takeAccountHero(o(), ACCOUNT);
    expect(getProfile(db, user)?.heroName).toBe('Bea');
    expect(db.select().from(outbox).all()).toEqual([]);
  });
});
