import { eq } from 'drizzle-orm';

import { completeHabit } from '../../db/queries/completions';
import { buyGear, listInventory } from '../../db/queries/gear';
import { createHabit, getHabit, updateHabit, type HabitFields } from '../../db/queries/habits';
import { getCharacter } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { characters, completions } from '../../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../../db/types';
import { FakeSyncServer } from '../../test/fake-sync-server';
import { createTestDb } from '../../test/test-db';
import { createSyncEngine } from '../engine';

const NOW = Date.parse('2026-10-26T15:00:00Z');
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
beforeEach(async () => {
  db = await createTestDb();
  server = new FakeSyncServer();
  recordSignIn(db, { id: newId(), email: 'ada@example.com' });
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'America/Toronto', now: NOW });
});

const sync = () =>
  createSyncEngine({ db, transport: server, appVersion: '0', newId, now: () => NOW }).syncNow();
const habit = () => {
  const id = newId();
  createHabit(db, { userId: user, id, now: NOW, fields: READ });
  return id;
};

describe('a refused change is undone on the phone', () => {
  it('a refused completion goes, and the hero is the server’s, without its reward', async () => {
    const id = habit();
    const done = completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    expect(getCharacter(db, user)?.xpInLevel).toBeGreaterThan(0);
    server.character = { ...server.character, xp_in_level: 0, gold: 0 };
    server.reject = (c) => (c.table === 'completions' ? 'duplicate' : null);

    const outcome = await sync();
    expect(outcome.rejected).toEqual([
      { id: done!.completionId, table: 'completions', reason: 'duplicate' },
    ]);
    expect(db.select().from(completions).all()).toEqual([]);
    expect(getCharacter(db, user)).toMatchObject({ xpInLevel: 0, gold: 0 });
  });

  it('a purchase the server could not afford goes, and the gold is the server’s', async () => {
    db.update(characters).set({ gold: 100 }).where(eq(characters.userId, user)).run();
    buyGear(db, { userId: user, itemId: 'oak-shield', now: NOW, newId });
    server.character = { ...server.character, gold: 7 };
    server.reject = (c) => (c.table === 'inventory' ? 'insufficient_gold' : null);

    await sync();
    expect(listInventory(db, user)).toEqual([]);
    expect(getCharacter(db, user)?.gold).toBe(7);
  });

  it('a refused new quest goes with its completions', async () => {
    const id = habit();
    completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    server.reject = (c) => (c.table === 'habits' || c.table === 'completions' ? 'invalid' : null);

    await sync();
    expect(getHabit(db, user, id)).toBeUndefined();
    expect(db.select().from(completions).all()).toEqual([]);
  });

  it('a refused edit to a quest the server already has keeps the quest', async () => {
    const id = habit();
    await sync();
    updateHabit(db, user, id, NOW + 60_000, { ...READ, name: 'Read 20 pages' });
    server.reject = (c) => (c.table === 'habits' ? 'invalid' : null);

    await sync();
    expect(getHabit(db, user, id)).toBeDefined();
  });
});
