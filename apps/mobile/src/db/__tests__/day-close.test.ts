import { eq } from 'drizzle-orm';

import { counterIds, createTestDb } from '../../test/test-db';
import { completeHabit } from '../queries/completions';
import { closeDays, dismissFaint, getPendingFaint } from '../queries/day-close';
import { archiveHabit, createHabit, type HabitFields } from '../queries/habits';
import { getCharacter } from '../queries/hero';
import { createHero, resetLocalData } from '../queries/local-data';
import { characters, dayClosures } from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';

// The hero is created on Tuesday 20 October 2026 at 18:00 in Toronto (UTC-4).
const NOW = Date.parse('2026-10-20T22:00:00Z');
const TZ = 'America/Toronto';
const user = LOCAL_USER_ID;
/** `hour`:00 Toronto time on October `day`. */
const at = (day: number, hour: number) =>
  Date.parse(`2026-10-${day}T${String(hour + 4).padStart(2, '0')}:00:00Z`);

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

const addHabit = (overrides: Partial<HabitFields> = {}) => {
  const id = newId();
  createHabit(db, { userId: user, id, now: NOW, fields: fields(overrides) });
  return id;
};
const hero = () => getCharacter(db, user);

describe('closeDays', () => {
  it('waits until 03:00 the next morning to close a day', () => {
    addHabit();
    expect(closeDays(db, user, NOW).closedDates).toEqual([]);
    expect(closeDays(db, user, at(21, 2)).closedDates).toEqual([]);

    const summary = closeDays(db, user, at(21, 3));
    expect(summary).toEqual({ closedDates: ['2026-10-20'], hpLost: 6, faint: null });
    expect(hero()).toMatchObject({ hp: 38, currentStreak: 0, lastClosedDate: '2026-10-20' });
  });

  it('closes each day only once', () => {
    addHabit();
    closeDays(db, user, at(21, 3));
    expect(closeDays(db, user, at(21, 9)).closedDates).toEqual([]);
    expect(hero()?.hp).toBe(38);
    expect(db.select().from(dayClosures).all()).toHaveLength(1);
  });

  it('spares completed quests and grows the streak', () => {
    const habitId = addHabit();
    completeHabit(db, { userId: user, habitId, now: NOW, newId });
    const hpBefore = hero()?.hp;

    expect(closeDays(db, user, at(21, 4)).hpLost).toBe(0);
    expect(hero()).toMatchObject({ hp: hpBefore, currentStreak: 1, longestStreak: 1 });
  });

  it('catches up on several days in order', () => {
    addHabit();
    addHabit({ name: 'Swim', type: 'weekdays', weekdays: 1 }); // Mondays only
    const summary = closeDays(db, user, at(24, 4));

    expect(summary.closedDates).toEqual(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    expect(summary.hpLost).toBe(24);
    expect(hero()?.hp).toBe(20);
  });

  it('skips quests archived on or before the day', () => {
    const habitId = addHabit();
    archiveHabit(db, user, habitId, NOW);
    expect(closeDays(db, user, at(21, 4)).hpLost).toBe(0);
  });

  it('faints at 0 HP and keeps the notice until it is dismissed', () => {
    addHabit({ name: 'Code for 1 hour' });
    addHabit({ name: 'No doomscrolling', type: 'bad' });
    db.update(characters)
      .set({ hp: 5, gold: 101, xpInLevel: 30 })
      .where(eq(characters.userId, user))
      .run();

    const { faint } = closeDays(db, user, at(21, 4));
    const notice = {
      date: '2026-10-20',
      goldLost: 25,
      xpLost: 30,
      missed: ['Code for 1 hour', 'No doomscrolling'],
    };
    expect(faint).toEqual(notice);
    // New hero: CON 5 gives 44 max HP; fainting comes back with half.
    expect(hero()).toMatchObject({ hp: 22, gold: 76, xpInLevel: 0, level: 1 });
    expect(getPendingFaint(db)).toEqual(notice);

    dismissFaint(db);
    expect(getPendingFaint(db)).toBeNull();
  });

  it('forgets an unseen faint when the player data is reset', () => {
    addHabit();
    db.update(characters).set({ hp: 1 }).where(eq(characters.userId, user)).run();
    closeDays(db, user, at(21, 4));
    resetLocalData(db);
    expect(getPendingFaint(db)).toBeNull();
  });

  it('adds a new faint to one the player has not seen yet', () => {
    addHabit({ name: 'Code for 1 hour' });
    db.update(characters).set({ hp: 5, gold: 100 }).where(eq(characters.userId, user)).run();
    closeDays(db, user, at(21, 4));
    db.update(characters).set({ hp: 5 }).where(eq(characters.userId, user)).run();
    closeDays(db, user, at(22, 4));

    expect(getPendingFaint(db)).toEqual({
      date: '2026-10-21',
      goldLost: 25 + 18,
      xpLost: 0,
      missed: ['Code for 1 hour'],
    });
  });
});
