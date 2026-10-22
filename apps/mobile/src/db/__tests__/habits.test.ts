import { counterIds, createTestDb } from '../../test/test-db';
import { listActiveHabits } from '../queries/hero';
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  getHabit,
  reorderHabits,
  updateHabit,
  type HabitFields,
} from '../queries/habits';
import { createHero } from '../queries/local-data';
import { LOCAL_USER_ID, type AppDb } from '../types';

const NOW = Date.parse('2026-10-20T22:00:00Z');
const TZ = 'America/Toronto';
const user = LOCAL_USER_ID;

const fields = (overrides: Partial<HabitFields> = {}): HabitFields => ({
  name: 'Read 20 pages',
  type: 'daily',
  difficulty: 'medium',
  category: 'mind',
  weekdays: 127,
  ...overrides,
});

let db: AppDb;
let newId: () => string;
beforeEach(async () => {
  db = await createTestDb();
  newId = counterIds();
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: TZ, now: NOW });
});

describe('createHabit', () => {
  it('stores the habit with today as its creation date, at the end of the list', () => {
    createHabit(db, { userId: user, id: 'a', now: NOW, fields: fields({ name: 'First' }) });
    createHabit(db, { userId: user, id: 'b', now: NOW, fields: fields({ name: 'Second' }) });

    expect(listActiveHabits(db, user).map((h) => [h.name, h.sortOrder])).toEqual([
      ['First', 0],
      ['Second', 1],
    ]);
    expect(getHabit(db, user, 'a')).toMatchObject({ createdDate: '2026-10-20', category: 'mind' });
  });

  it('needs a hero first', async () => {
    const empty = await createTestDb();
    expect(() =>
      createHabit(empty, { userId: user, id: newId(), now: NOW, fields: fields() }),
    ).toThrow('no hero yet');
  });
});

describe('editing', () => {
  beforeEach(() => createHabit(db, { userId: user, id: 'h', now: NOW, fields: fields() }));

  it('updates the fields and the edit time', () => {
    updateHabit(db, user, 'h', NOW + 60_000, fields({ name: 'Read 30 pages', difficulty: 'hard' }));
    expect(getHabit(db, user, 'h')).toMatchObject({
      name: 'Read 30 pages',
      difficulty: 'hard',
      clientUpdatedAt: '2026-10-20T22:01:00.000Z',
    });
  });

  it('archives a habit: hidden, but the row and its history stay', () => {
    archiveHabit(db, user, 'h', NOW);
    expect(listActiveHabits(db, user)).toHaveLength(0);
    expect(getHabit(db, user, 'h')?.archivedAt).toBe('2026-10-20T22:00:00.000Z');
  });

  it('deletes a habit softly, leaving a tombstone', () => {
    deleteHabit(db, user, 'h', NOW);
    expect(listActiveHabits(db, user)).toHaveLength(0);
    expect(getHabit(db, user, 'h')?.deletedAt).toBe('2026-10-20T22:00:00.000Z');
  });

  it('ignores another user’s habit', () => {
    updateHabit(db, 'someone-else', 'h', NOW, fields({ name: 'Hacked' }));
    expect(getHabit(db, user, 'h')?.name).toBe('Read 20 pages');
    expect(getHabit(db, 'someone-else', 'h')).toBeUndefined();
  });
});

describe('reorderHabits', () => {
  const add = (id: string, name: string) =>
    createHabit(db, { userId: user, id, now: NOW, fields: fields({ name }) });
  const names = () => listActiveHabits(db, user).map((h) => h.name);
  const LATER = NOW + 60_000;

  it('saves the new order and stamps only the habits that moved', () => {
    add('a', 'A');
    add('b', 'B');
    add('c', 'C');
    reorderHabits(db, user, ['a', 'c', 'b'], LATER);

    expect(names()).toEqual(['A', 'C', 'B']);
    const stamp = (id: string) => getHabit(db, user, id)?.clientUpdatedAt;
    expect(stamp('a')).toBe(new Date(NOW).toISOString());
    expect(stamp('b')).toBe(new Date(LATER).toISOString());
    expect(stamp('c')).toBe(new Date(LATER).toISOString());
  });

  it('moves only the listed habits, keeping the others in their place', () => {
    add('a', 'A');
    add('x', 'Not today');
    add('b', 'B');
    add('c', 'C');
    reorderHabits(db, user, ['c', 'a', 'b'], LATER);

    expect(names()).toEqual(['C', 'Not today', 'A', 'B']);
  });

  it('ignores ids of archived or unknown habits', () => {
    add('a', 'A');
    add('b', 'B');
    archiveHabit(db, user, 'b', NOW);
    reorderHabits(db, user, ['b', 'zzz', 'a'], LATER);

    expect(names()).toEqual(['A']);
  });
});
