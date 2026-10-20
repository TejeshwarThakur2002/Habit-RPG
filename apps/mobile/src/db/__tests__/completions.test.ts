import { eq } from 'drizzle-orm';

import { counterIds, createTestDb } from '../../test/test-db';
import { completeHabit, undoCompletion } from '../queries/completions';
import { getCharacter, listActiveHabits } from '../queries/hero';
import { createHero } from '../queries/local-data';
import { getQuestBoard } from '../queries/quest-board';
import { characters, completions, habits } from '../schema';
import { seedDemo } from '../seed-demo';
import { LOCAL_USER_ID, type AppDb } from '../types';

// Tuesday 20 October 2026, 18:00 in Toronto.
const NOW = Date.parse('2026-10-20T22:00:00Z');
const TODAY = '2026-10-20';
const TZ = 'America/Toronto';
const user = LOCAL_USER_ID;

let db: AppDb;
let newId: () => string;
beforeEach(async () => {
  db = await createTestDb();
  newId = counterIds();
});

function addHabit(overrides: Partial<typeof habits.$inferInsert> = {}) {
  const id = newId();
  db.insert(habits)
    .values({
      id,
      userId: user,
      name: 'Read 20 pages',
      type: 'daily',
      difficulty: 'medium',
      category: 'mind',
      createdDate: '2026-10-01',
      clientUpdatedAt: '2026-10-01T00:00:00.000Z',
      ...overrides,
    })
    .run();
  return id;
}

describe('completeHabit', () => {
  beforeEach(() => createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: TZ, now: NOW }));

  it('records the completion and adds its XP and gold', () => {
    const habitId = addHabit();
    const result = completeHabit(db, { userId: user, habitId, now: NOW, newId });

    // New hero: INT 5, no streak, so 20 * 1.025 = 20.5 -> 21 XP and 6 gold (or 12 on a crit).
    expect(result?.reward.xp).toBe(21);
    const row = db.select().from(completions).get();
    expect(row).toMatchObject({ habitId, localDate: TODAY, xpAwarded: 21, category: 'mind' });
    expect(getCharacter(db, user)).toMatchObject({ xpInLevel: 21, gold: result?.reward.gold });
  });

  it('ignores a second completion of the same habit on the same day', () => {
    const habitId = addHabit();
    completeHabit(db, { userId: user, habitId, now: NOW, newId });
    expect(completeHabit(db, { userId: user, habitId, now: NOW + 1000, newId })).toBeNull();
    expect(db.select().from(completions).all()).toHaveLength(1);
  });

  it('levels up across the threshold: refills HP and adds 25 gold', () => {
    db.update(characters).set({ xpInLevel: 190, hp: 20 }).where(eq(characters.userId, user)).run();
    const result = completeHabit(db, { userId: user, habitId: addHabit(), now: NOW, newId });

    expect(result?.levelsGained).toBe(1);
    expect(getCharacter(db, user)).toMatchObject({
      level: 2,
      xpInLevel: 11,
      hp: 44,
      gold: 25 + (result?.reward.gold ?? 0),
    });
  });

  it('returns null for an unknown habit', () => {
    expect(completeHabit(db, { userId: user, habitId: 'nope', now: NOW, newId })).toBeNull();
  });
});

describe('undoCompletion', () => {
  beforeEach(() => createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: TZ, now: NOW }));

  it('marks the completion undone and takes back its XP and gold', () => {
    const habitId = addHabit();
    completeHabit(db, { userId: user, habitId, now: NOW, newId });
    expect(undoCompletion(db, user, habitId, NOW + 1000)).toBe(true);

    expect(db.select().from(completions).get()?.undoneAt).not.toBeNull();
    expect(getCharacter(db, user)).toMatchObject({ xpInLevel: 0, gold: 0, level: 1 });
  });

  it('never takes back a level: XP clamps at 0', () => {
    db.update(characters).set({ xpInLevel: 190 }).where(eq(characters.userId, user)).run();
    const habitId = addHabit();
    completeHabit(db, { userId: user, habitId, now: NOW, newId });
    undoCompletion(db, user, habitId, NOW + 1000);
    expect(getCharacter(db, user)).toMatchObject({ level: 2, xpInLevel: 0 });
  });

  it('lets the habit be completed again after an undo', () => {
    const habitId = addHabit();
    completeHabit(db, { userId: user, habitId, now: NOW, newId });
    undoCompletion(db, user, habitId, NOW + 1000);
    expect(completeHabit(db, { userId: user, habitId, now: NOW + 2000, newId })).not.toBeNull();
  });

  it('does nothing when there is nothing to undo', () => {
    expect(undoCompletion(db, user, addHabit(), NOW)).toBe(false);
  });
});

describe('getQuestBoard', () => {
  it('shows the demo hero with today’s quests and the party boss', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId });
    const board = getQuestBoard(db, user, TODAY);

    expect(board).toMatchObject({
      heroName: 'Sir Commit',
      level: 7,
      hp: 42,
      gold: 128,
      streak: 12,
      xpToNext: 500,
    });
    expect(board?.today.map((q) => q.doneToday)).toEqual([true, true, false, false, false]);
    expect(board?.boss).toEqual({ bossKey: 'procrastination-slime', hpPercent: 62 });
    expect(board?.equipped).toEqual(['iron-sword']);
  });

  it('previews the real reward, including the streak bonus', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId });
    const board = getQuestBoard(db, user, TODAY);
    const [, code] = board?.today ?? [];
    // Code for 1 hour: medium (20), 12-day streak (x1.5) and the demo hero's INT.
    expect(code?.rewardXp).toBeGreaterThan(30);
  });

  it('moves habits not scheduled today into "later this week"', () => {
    createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: TZ, now: NOW });
    addHabit({ name: 'Daily' });
    addHabit({ name: 'Mondays', type: 'weekdays', weekdays: 1 });
    const board = getQuestBoard(db, user, TODAY);

    expect(board?.today.map((q) => q.habit.name)).toEqual(['Daily']);
    expect(board?.laterThisWeek.map((h) => h.name)).toEqual(['Mondays']);
    expect(board?.boss).toBeNull();
  });

  it('is null before a hero exists', () => {
    expect(getQuestBoard(db, user, TODAY)).toBeNull();
    expect(listActiveHabits(db, user)).toHaveLength(0);
  });
});
