import type { SyncRequest } from '@habit-rpg/shared';

import { completeHabit } from '../../db/queries/completions';
import { createHabit } from '../../db/queries/habits';
import { getProfile } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { getSyncState } from '../../db/queries/sync-state';
import { outbox } from '../../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../../db/types';
import { FakeSyncServer } from '../../test/fake-sync-server';
import { createTestDb } from '../../test/test-db';
import { closeHeroChoice, currentHeroChoice } from '../hero-choice';
import { currentNotice, dismissNotice } from '../notices';
import {
  HERO_REPLACED_NOTICE,
  WRITE_DELAY_MS,
  createSyncService,
  type SyncService,
} from '../sync-service';

const NOW = Date.parse('2026-10-26T15:00:00Z');
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const user = LOCAL_USER_ID;
const newId = () => crypto.randomUUID();

type Timer = { run: () => void; ms: number };
let db: AppDb;
let server: FakeSyncServer;
let timers: Timer[];
let service: SyncService;

beforeEach(async () => {
  db = await createTestDb();
  server = new FakeSyncServer();
  timers = [];
  service = makeService(server);
});
afterEach(() => {
  while (currentNotice() !== null) dismissNotice();
  closeHeroChoice();
});

function makeService(transport: { send: FakeSyncServer['send'] }) {
  return createSyncService({
    db,
    transport,
    appVersion: '0',
    newId,
    now: () => NOW,
    setTimer: (run, ms) => {
      const timer = { run, ms };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      timers = timers.filter((t) => t !== handle);
    },
  });
}

/** Runs the oldest pending timer, then waits for any sync it started. */
async function fire(): Promise<number | undefined> {
  const timer = timers.shift();
  timer?.run();
  await service.settled();
  return timer?.ms;
}

const signedIn = () => {
  recordSignIn(db, { id: ACCOUNT, email: 'ada@example.com' });
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'UTC', now: NOW - 86_400_000 });
};
const quest = () => {
  const id = newId();
  createHabit(db, {
    userId: user,
    id,
    now: NOW,
    fields: {
      name: 'Read',
      type: 'daily',
      difficulty: 'easy',
      category: 'mind',
      weekdays: 127,
      reminderTime: null,
    },
  });
  return id;
};
const waiting = () => db.select().from(outbox).all().length;
/** Signed in, with the first sync done, so ordinary syncs run. */
async function synced() {
  signedIn();
  await service.firstSync(ACCOUNT);
  server.requests = [];
}

describe('the sync service', () => {
  it('never syncs the demo or a hero kept only on this phone', async () => {
    createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'UTC', now: NOW });
    await service.request('start');
    await service.request('manual');
    expect(server.requests).toEqual([]);
  });

  it('runs a pending first sync at start, not on the other triggers', async () => {
    signedIn();
    await service.request('foreground');
    await service.request('reconnect');
    expect(server.requests).toEqual([]);
    await service.request('start');
    expect(server.requests[0]?.import?.done).toBe(true);
    expect(getSyncState(db, newId).userId).toBe(ACCOUNT);
    expect(service.activity()).toEqual({ state: 'idle', message: null });
  });

  it("asks which hero to keep, and doesn't ask again when the app comes back", async () => {
    signedIn();
    server.failNext('hero-exists');
    await service.request('start');
    expect(currentHeroChoice()).toMatchObject({ accountUserId: ACCOUNT });
    expect(service.activity().state).toBe('error');

    closeHeroChoice();
    await service.request('foreground');
    expect(currentHeroChoice()).toBeNull();
    expect(server.requests).toHaveLength(1);
  });

  it('sends local changes once, 2 s after the last one', async () => {
    await synced();
    const id = quest();
    service.afterWrite();
    completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    service.afterWrite();
    expect(timers.map((t) => t.ms)).toEqual([WRITE_DELAY_MS]);

    await fire();
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.changes.map((c) => c.table)).toEqual(['habits', 'completions']);
    expect(waiting()).toBe(0);

    service.afterWrite();
    await fire();
    expect(server.requests).toHaveLength(1);
  });

  it('says when it is offline, and its retry runs through the service', async () => {
    await synced();
    quest();
    server.failNext('offline');
    await service.request('write');
    expect(service.activity()).toEqual({ state: 'offline', message: 'offline' });
    expect(waiting()).toBe(1);

    expect(await fire()).toBe(2000);
    expect(service.activity()).toEqual({ state: 'idle', message: null });
    expect(waiting()).toBe(0);
  });

  it("leaves a failed attempt's retry to the backoff, but sends a new change", async () => {
    await synced();
    quest();
    server.failNext('offline', 'offline');
    await service.request('write');
    // The attempt itself updated the outbox, which the app reports as a change.
    service.afterWrite();
    await timers.pop()?.run();
    await service.settled();
    expect(server.requests).toHaveLength(1);

    quest();
    service.afterWrite();
    await timers.pop()?.run();
    await service.settled();
    expect(server.requests).toHaveLength(2);
  });

  it('tells the player about changes the server refused', async () => {
    await synced();
    quest();
    server.reject = () => 'invalid';
    await service.request('write');
    expect(currentNotice()).toBe("A change couldn't be saved and was undone.");
  });

  it('swaps in a hero replaced from another phone, and says so', async () => {
    await synced();
    quest();
    server.failNext('hero-replaced');
    server.seed({
      table: 'profiles',
      op: 'upsert',
      data: {
        id: ACCOUNT,
        hero_name: 'Bea',
        class: 'rogue',
        timezone: 'UTC',
        created_at: '2026-10-20T12:00:00.000Z',
        server_seq: 99,
        updated_at: '2026-10-20T12:00:00.000Z',
      },
    });
    await service.request('foreground');
    expect(getProfile(db, user)?.heroName).toBe('Bea');
    expect(waiting()).toBe(0);
    expect(currentNotice()).toBe(HERO_REPLACED_NOTICE);
  });

  it('never runs two syncs at once; triggers that arrive meanwhile share one more', async () => {
    await synced();
    let inFlight = 0;
    let most = 0;
    let started: () => void = () => undefined;
    const firstStarted = new Promise<void>((resolve) => (started = resolve));
    service = makeService({
      async send(request: SyncRequest) {
        inFlight += 1;
        most = Math.max(most, inFlight);
        started();
        await new Promise((resolve) => setImmediate(resolve));
        inFlight -= 1;
        return server.send(request);
      },
    });
    void service.request('foreground');
    void service.request('write');
    await firstStarted;
    void service.request('reconnect');
    void service.request('write');
    await service.settled();
    expect(most).toBe(1);
    expect(server.requests).toHaveLength(2);
  });
});
