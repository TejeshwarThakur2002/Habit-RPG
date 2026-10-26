import { changeSchema } from '@habit-rpg/shared';
import { eq } from 'drizzle-orm';

import { completeHabit, undoCompletion } from '../../db/queries/completions';
import { buyGear, setEquipped } from '../../db/queries/gear';
import { archiveHabit, createHabit, type HabitFields } from '../../db/queries/habits';
import { getProfile } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { updateSettings } from '../../db/queries/settings';
import { getSyncState } from '../../db/queries/sync-state';
import { characters, completions, outbox } from '../../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../../db/types';
import { FakeSyncServer } from '../../test/fake-sync-server';
import { createTestDb } from '../../test/test-db';
import { buildImport, needsFirstSync, runFirstSync } from '../first-sync';

const NOW = Date.parse('2026-10-26T15:00:00Z');
const DAY = 86_400_000;
const user = LOCAL_USER_ID;
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const newId = () => crypto.randomUUID();
const READ: HabitFields = {
  name: 'Read',
  type: 'daily',
  difficulty: 'easy',
  category: 'mind',
  weekdays: 127,
  reminderTime: null,
};

let db: AppDb;
let server: FakeSyncServer;
beforeEach(async () => {
  db = await createTestDb();
  server = new FakeSyncServer();
});

const hero = (at = NOW - 3 * DAY) =>
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'America/Toronto', now: at });
const signIn = () => recordSignIn(db, { id: ACCOUNT, email: 'ada@example.com' });
const habit = (at = NOW - 3 * DAY) => {
  const id = newId();
  createHabit(db, { userId: user, id, now: at, fields: READ });
  return id;
};
const first = () =>
  runFirstSync({ db, transport: server, appVersion: '0', newId, now: () => NOW }, ACCOUNT);
const synced = () => getSyncState(db, newId).userId;

describe('buildImport', () => {
  it('sends the profile, every quest, then completions and purchases in time order', () => {
    hero();
    const read = habit();
    const run = habit();
    archiveHabit(db, user, run, NOW - DAY);
    completeHabit(db, { userId: user, habitId: read, now: NOW - 2 * DAY, newId });
    db.update(characters).set({ gold: 100 }).where(eq(characters.userId, user)).run();
    buyGear(db, { userId: user, itemId: 'oak-shield', now: NOW - 2 * DAY + 3600_000, newId });
    setEquipped(db, user, 'oak-shield', true, NOW - DAY);
    completeHabit(db, { userId: user, habitId: read, now: NOW, newId });
    undoCompletion(db, user, read, NOW + 60_000);

    const changes = buildImport(db).map((c) => changeSchema.parse(c));
    expect(changes.map((c) => c.table)).toEqual([
      'profiles',
      'habits',
      'habits',
      'completions',
      'inventory',
      'completions',
    ]);
    expect(changes[0]).toMatchObject({ client_updated_at: getProfile(db, user)?.createdAt });
    expect(changes[4]).toMatchObject({ data: { item_id: 'oak-shield', equipped: true } });
    expect(changes[5]).toMatchObject({ data: { undone_at: new Date(NOW + 60_000).toISOString() } });
  });
});

describe('needsFirstSync', () => {
  it('is only for an account this phone has not synced with', async () => {
    hero();
    expect(needsFirstSync(db, newId)).toBe(false);
    signIn();
    expect(needsFirstSync(db, newId)).toBe(true);
    await first();
    expect(needsFirstSync(db, newId)).toBe(false);
    updateSettings(db, { demoMode: true });
    expect(needsFirstSync(db, newId)).toBe(false);
  });
});

describe('runFirstSync', () => {
  it("uploads the phone's hero as an import, then takes the server's version", async () => {
    signIn();
    hero();
    const id = habit();
    const done = completeHabit(db, { userId: user, habitId: id, now: NOW, newId });

    expect(await first()).toEqual({ status: 'done', rejected: [], pulledHero: false });
    expect(server.requests[0]?.import).toEqual({
      started_at: getProfile(db, user)?.createdAt,
      done: true,
    });
    expect(db.select().from(outbox).all()).toEqual([]);
    expect(synced()).toBe(ACCOUNT);
    const row = db.select().from(completions).where(eq(completions.id, done!.completionId)).get();
    expect(row?.xpAwarded).toBe(12);
  });

  it('sends a long history in batches of 200, the last marked done', async () => {
    signIn();
    hero(NOW - 400 * DAY);
    const id = habit(NOW - 400 * DAY);
    for (let d = 1; d <= 210; d++) {
      completeHabit(db, { userId: user, habitId: id, now: NOW - d * DAY, newId });
    }
    await first();
    const imports = server.requests.filter((r) => r.import);
    expect(imports.map((r) => [r.changes.length, r.import?.done])).toEqual([
      [200, false],
      [12, true],
    ]);
  });

  it("pulls the account's hero onto a fresh phone", async () => {
    const other = new FakeSyncServer();
    const twin = await createTestDb();
    recordSignIn(twin, { id: ACCOUNT, email: 'ada@example.com' });
    createHero(twin, { heroName: 'Bea', heroClass: 'rogue', timeZone: 'UTC', now: NOW });
    await runFirstSync(
      { db: twin, transport: other, appVersion: '0', newId, now: () => NOW },
      ACCOUNT,
    );
    for (const row of other.stored('profiles')) server.seed(row);

    expect(await first()).toEqual({ status: 'done', rejected: [], pulledHero: true });
    expect(getProfile(db, user)).toMatchObject({ heroName: 'Bea', heroClass: 'rogue' });
    expect(synced()).toBe(ACCOUNT);
  });

  it('stops at a conflict when the account already has another hero, changing nothing', async () => {
    signIn();
    hero();
    habit();
    server.failNext('hero-exists');
    expect(await first()).toEqual({
      status: 'conflict',
      accountHero: { hero_name: 'Bea', class: 'rogue', level: 3 },
    });
    expect(db.select().from(outbox).all().length).toBeGreaterThan(0);
    expect(getProfile(db, user)?.heroName).toBe('Ada');
    expect(synced()).toBeNull();
  });

  it('offline, it leaves everything for a later try', async () => {
    signIn();
    server.failNext('offline');
    expect((await first()).status).toBe('offline');
    expect(synced()).toBeNull();
  });

  it('once the import is done, the account counts as synced even if the pull then fails', async () => {
    signIn();
    hero();
    server.failNext('ok', 'offline');
    expect((await first()).status).toBe('offline');
    expect(synced()).toBe(ACCOUNT);
  });

  it("undoes the import's refused changes", async () => {
    signIn();
    hero();
    const id = habit();
    completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    server.reject = (c) => (c.table === 'completions' ? 'date_out_of_range' : null);
    const outcome = await first();
    expect(outcome.status === 'done' && outcome.rejected.map((r) => r.reason)).toEqual([
      'date_out_of_range',
    ]);
    expect(db.select().from(completions).all()).toEqual([]);
  });
});
