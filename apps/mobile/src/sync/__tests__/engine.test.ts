import { eq } from 'drizzle-orm';

import { completeHabit } from '../../db/queries/completions';
import { createHabit, getHabit, updateHabit, type HabitFields } from '../../db/queries/habits';
import { getCharacter } from '../../db/queries/hero';
import { createHero, recordSignIn, resetLocalData } from '../../db/queries/local-data';
import { getSyncState } from '../../db/queries/sync-state';
import { completions, habits, outbox } from '../../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../../db/types';
import { createTestDb } from '../../test/test-db';
import { FakeSyncServer } from '../../test/fake-sync-server';
import { createSyncEngine, retryDelayMs } from '../engine';

const NOW = Date.parse('2026-10-24T15:00:00Z');
const user = LOCAL_USER_ID;
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
let timers: { run: () => void; ms: number }[];
beforeEach(async () => {
  db = await createTestDb();
  server = new FakeSyncServer();
  timers = [];
  recordSignIn(db, { id: newId(), email: 'ada@example.com' });
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'America/Toronto', now: NOW });
});

const engine = () =>
  createSyncEngine({
    db,
    transport: server,
    appVersion: '0.3.0',
    newId,
    now: () => NOW,
    setTimer: (run, ms) => timers.push({ run, ms }),
    clearTimer: () => undefined,
  });
const habit = (name = 'Read') => {
  const id = newId();
  createHabit(db, { userId: user, id, now: NOW, fields: { ...READ, name } });
  return id;
};
const queued = () => db.select().from(outbox).all();

describe('the sync engine', () => {
  it('sends the outbox and applies the answer: rows, rewards, hero and cursor', async () => {
    const id = habit();
    const done = completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    const outcome = await engine().syncNow();

    expect(outcome).toEqual({ status: 'synced', rejected: [] });
    expect(server.requests[0]?.changes.map((c) => c.table)).toEqual([
      'profiles',
      'habits',
      'completions',
    ]);
    expect(queued()).toEqual([]);
    // The server's reward and hero replace the phone's estimate.
    const row = db.select().from(completions).where(eq(completions.id, done!.completionId)).get();
    expect(row).toMatchObject({ xpAwarded: 12, goldAwarded: 4 });
    expect(getCharacter(db, user)).toMatchObject({ xpInLevel: 12, gold: 4 });
    expect(getHabit(db, user, id)?.serverSeq).not.toBeNull();
    expect(getSyncState(db, newId).cursor).toBe(3);
  });

  it("pulls another phone's rows page by page", async () => {
    const other = new FakeSyncServer();
    for (const name of ['Run', 'Stretch', 'Journal']) {
      createHabit(db, { userId: user, id: newId(), now: NOW, fields: { ...READ, name } });
    }
    await createSyncEngine({
      db,
      transport: other,
      appVersion: '0',
      newId,
      now: () => NOW,
    }).syncNow();
    resetLocalData(db);
    recordSignIn(db, { id: newId(), email: 'ada@example.com' });
    createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'America/Toronto', now: NOW });
    for (const row of other.stored('habits')) server.seed(row);
    server.pageSize = 2;

    expect((await engine().syncNow()).status).toBe('synced');
    // Four rows (three habits and this phone's profile), two per page: two requests.
    expect(server.requests.map((r) => r.cursor)).toEqual([0, 2]);
    expect(
      db
        .select({ name: habits.name })
        .from(habits)
        .all()
        .map((h) => h.name)
        .sort(),
    ).toEqual(['Journal', 'Run', 'Stretch']);
  });

  it('runs one sync at a time: a second request joins the first', async () => {
    habit();
    const sync = engine();
    const [a, b] = [sync.syncNow(), sync.syncNow()];
    expect(a).toBe(b);
    await a;
    expect(server.requests).toHaveLength(1);
  });

  it('keeps the outbox when offline and retries after 2 s, 4 s, then succeeds', async () => {
    habit();
    server.failNext('offline', 'server');
    const sync = engine();
    expect(await sync.syncNow()).toMatchObject({ status: 'offline', retryInMs: 2000 });
    expect(queued().map((r) => [r.attempts, r.lastError])).toEqual([
      [1, 'offline'],
      [1, 'offline'],
    ]);
    timers.shift()?.run();
    expect(await sync.syncNow()).toMatchObject({ status: 'error', retryInMs: 4000 });
    timers.shift()?.run();
    expect((await sync.syncNow()).status).toBe('synced');
    expect(queued()).toEqual([]);
  });

  it('a reply lost after the server applied the changes is sent again and counted once', async () => {
    const id = habit();
    completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    server.failNext('lost-reply');
    const sync = engine();
    expect((await sync.syncNow()).status).toBe('offline');
    expect(queued()).toHaveLength(3);

    expect((await sync.syncNow()).status).toBe('synced');
    expect(server.requests[1]?.changes).toEqual(server.requests[0]?.changes);
    expect(server.stored('completions')).toHaveLength(1);
    expect(db.select().from(completions).all()).toHaveLength(1);
  });

  it('a change made during a sync stays queued and goes in the next round', async () => {
    const id = habit();
    let nameBetweenRounds: string | undefined;
    server.onRequest = () => {
      if (server.requests.length === 1) {
        updateHabit(db, user, id, NOW + 60_000, { ...READ, name: 'Read 20 pages' });
      }
      if (server.requests.length === 2) nameBetweenRounds = getHabit(db, user, id)?.name;
    };
    expect((await engine().syncNow()).status).toBe('synced');
    expect(server.requests).toHaveLength(2);
    expect(server.requests[1]?.changes).toMatchObject([{ id, data: { name: 'Read 20 pages' } }]);
    // Round one pulled the server's older version; the phone's unsent edit was kept.
    expect(nameBetweenRounds).toBe('Read 20 pages');
    expect(getHabit(db, user, id)?.name).toBe('Read 20 pages');
    expect(queued()).toEqual([]);
  });

  it('does not retry a refused sync by itself', async () => {
    habit();
    server.failNext('refused');
    expect(await engine().syncNow()).toMatchObject({ status: 'error', retryInMs: null });
    expect(timers).toEqual([]);
  });

  it('hands back what the server rejected and takes it out of the outbox', async () => {
    const id = habit();
    const done = completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    server.reject = (change) => (change.table === 'completions' ? 'duplicate' : null);
    const outcome = await engine().syncNow();
    expect(outcome.rejected).toEqual([
      { id: done!.completionId, table: 'completions', reason: 'duplicate' },
    ]);
    expect(queued()).toEqual([]);
  });

  it("an active completion from another phone wins over this phone's for the same day", async () => {
    const id = habit();
    await engine().syncNow();
    const mine = completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    db.delete(outbox).run();
    const theirs = newId();
    server.seed({
      table: 'completions',
      op: 'upsert',
      data: {
        id: theirs,
        habit_id: id,
        local_date: '2026-10-24',
        completed_at: '2026-10-24T14:00:00.000Z',
        undone_at: null,
        category: 'mind',
        xp_awarded: 12,
        gold_awarded: 4,
        boss_damage: 12,
        is_late: false,
        server_seq: 99,
        updated_at: '2026-10-24T14:00:00.000Z',
      },
    });
    await engine().syncNow();
    const rows = db
      .select({ id: completions.id, undoneAt: completions.undoneAt })
      .from(completions)
      .all();
    expect(rows.find((r) => r.id === theirs)?.undoneAt).toBeNull();
    expect(rows.find((r) => r.id === mine!.completionId)?.undoneAt).not.toBeNull();
  });

  it('wiping the player rewinds the cursor', async () => {
    habit();
    await engine().syncNow();
    expect(getSyncState(db, newId).cursor).toBeGreaterThan(0);
    resetLocalData(db);
    expect(getSyncState(db, newId).cursor).toBe(0);
  });
});

describe('retryDelayMs', () => {
  it('doubles from 2 s and stops at 5 minutes', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16_000]);
    expect(retryDelayMs(20)).toBe(300_000);
  });
});
