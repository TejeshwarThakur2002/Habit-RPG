import { changeSchema } from '@habit-rpg/shared';
import { eq } from 'drizzle-orm';

import { createTestDb } from '../../test/test-db';
import { completeHabit, undoCompletion } from '../queries/completions';
import { buyGear, setEquipped, undoPurchase } from '../queries/gear';
import {
  archiveHabit,
  createHabit,
  reorderHabits,
  updateHabit,
  type HabitFields,
} from '../queries/habits';
import { updateProfile } from '../queries/hero';
import { createHero, recordSignIn } from '../queries/local-data';
import { characters, outbox } from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';

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
beforeEach(async () => {
  db = await createTestDb();
});

const hero = () =>
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'America/Toronto', now: NOW });
const signIn = () => recordSignIn(db, { id: newId(), email: 'ada@example.com' });
const queued = () => db.select().from(outbox).orderBy(outbox.id).all();
const summary = () => queued().map((r) => [r.tableName, r.op]);
const habit = (fields: Partial<HabitFields> = {}) => {
  const id = newId();
  createHabit(db, { userId: user, id, now: NOW, fields: { ...READ, ...fields } });
  return id;
};

describe('the outbox', () => {
  it('queues nothing for a hero kept only on this phone', () => {
    hero();
    const id = habit();
    completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    expect(queued()).toEqual([]);
  });

  it('queues every change the server takes, as a valid sync change, latest state only', () => {
    signIn();
    hero();
    const id = habit();
    const done = completeHabit(db, { userId: user, habitId: id, now: NOW, newId });
    undoCompletion(db, user, id, NOW + 60_000);
    updateProfile(db, user, { heroName: 'Lady Ada' }, NOW + 120_000);
    db.update(characters).set({ gold: 100 }).where(eq(characters.userId, user)).run();
    const bought = buyGear(db, { userId: user, itemId: 'oak-shield', now: NOW, newId });
    setEquipped(db, user, 'oak-shield', true, NOW + 180_000);
    archiveHabit(db, user, id, NOW + 240_000);

    // One row per synced row, in the order each was first changed.
    expect(summary()).toEqual([
      ['profiles', 'upsert'],
      ['habits', 'upsert'],
      ['completions', 'upsert'],
      ['inventory', 'upsert'],
    ]);
    const changes = queued().map((r) => changeSchema.parse(r.payload));
    expect(changes[0]).toMatchObject({ id: 'me', data: { hero_name: 'Lady Ada' } });
    expect(changes[1]).toMatchObject({ id, data: { archived_at: '2026-10-24T15:04:00.000Z' } });
    expect(changes[2]).toMatchObject({
      id: done?.completionId,
      data: { habit_id: id, undone_at: '2026-10-24T15:01:00.000Z' },
    });
    expect(changes[3]).toMatchObject({
      id: bought.ok ? bought.inventoryId : '',
      data: { item_id: 'oak-shield', equipped: true },
    });
    // Rewards are the server's to work out (D35); the phone never sends them.
    expect(JSON.stringify(changes)).not.toMatch(/xp_awarded|gold_awarded/);
  });

  it('never rewrites a change that is being sent; the newer one waits behind it', () => {
    signIn();
    hero();
    const id = habit();
    db.update(outbox).set({ attempts: 1 }).where(eq(outbox.rowId, id)).run();
    updateHabit(db, user, id, NOW + 60_000, { ...READ, name: 'Read 20 pages' });

    const rows = queued().filter((r) => r.rowId === id);
    expect(rows.map((r) => r.attempts)).toEqual([1, 0]);
    expect(rows.map((r) => changeSchema.parse(r.payload))).toMatchObject([
      { data: { name: 'Read' } },
      { data: { name: 'Read 20 pages' } },
    ]);
  });

  it('an undone purchase drops its unsent upserts and queues the delete', () => {
    signIn();
    hero();
    db.update(characters).set({ gold: 100 }).where(eq(characters.userId, user)).run();
    const bought = buyGear(db, { userId: user, itemId: 'oak-shield', now: NOW, newId });
    if (!bought.ok) throw new Error('purchase refused');
    setEquipped(db, user, 'oak-shield', true, NOW);
    undoPurchase(db, user, bought.inventoryId, NOW + 1000);

    expect(queued().filter((r) => r.tableName === 'inventory')).toMatchObject([
      { rowId: bought.inventoryId, op: 'delete', payload: { op: 'delete' } },
    ]);
  });

  it('reordering queues only the quests whose place changed', () => {
    signIn();
    hero();
    const [a, b, c] = [habit(), habit(), habit()];
    db.update(outbox).set({ attempts: 1 }).run();
    reorderHabits(db, user, [b, a, c], NOW + 60_000);

    const fresh = queued().filter((r) => r.attempts === 0);
    expect(fresh.map((r) => r.rowId).sort()).toEqual([a, b].sort());
  });
});
