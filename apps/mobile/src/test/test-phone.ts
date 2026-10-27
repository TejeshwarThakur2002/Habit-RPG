// A simulated phone for the two-phone test (D53): its own migrated sql.js database and its own
// sync service, talking to the real `sync` function. The network can be cut, and the next reply
// can be lost after the server has applied the request.

import { completions, habits, outbox } from '../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../db/types';
import type { SyncTransport } from '../sync/engine';
import { createSyncService, type SyncService } from '../sync/sync-service';
import { httpTransport, type TestAccount } from './sync-stack';
import { createTestDb } from './test-db';

export const PLAYER = LOCAL_USER_ID;

export interface TestPhone {
  name: string;
  db: AppDb;
  service: SyncService;
  online: boolean;
  /** The server applies the next request, but its answer never arrives. */
  loseNextReply: boolean;
  sync(): Promise<unknown>;
  waiting(): number;
}

export async function newPhone(name: string, account: TestAccount): Promise<TestPhone> {
  const db = await createTestDb();
  const http = httpTransport(account);
  const phone: TestPhone = {
    name,
    db,
    online: true,
    loseNextReply: false,
    service: undefined as unknown as SyncService,
    // Retries aren't scheduled: the test decides when each phone syncs.
    sync: () => phone.service.request('manual'),
    waiting: () => db.select().from(outbox).all().length,
  };
  const transport: SyncTransport = {
    async send(request) {
      if (!phone.online) return { ok: false, kind: 'offline', message: 'offline' };
      const result = await http.send(request);
      if (!phone.loseNextReply) return result;
      phone.loseNextReply = false;
      return { ok: false, kind: 'offline', message: 'reply lost' };
    },
  };
  phone.service = createSyncService({
    db,
    transport,
    appVersion: 'two-phones',
    newId: () => crypto.randomUUID(),
    now: Date.now,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  return phone;
}

/** The phone's quests and completions, in a form that compares with the server's. */
export function phoneRows(phone: TestPhone) {
  const quests = phone.db
    .select({ id: habits.id, name: habits.name })
    .from(habits)
    .all()
    .sort((a, b) => a.id.localeCompare(b.id));
  const done = phone.db
    .select({ id: completions.id, undone: completions.undoneAt })
    .from(completions)
    .all()
    .map((c) => ({ id: c.id, undone: c.undone !== null }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { quests, done };
}

/** A small seeded random generator (mulberry32), so a failing run can be replayed. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}
