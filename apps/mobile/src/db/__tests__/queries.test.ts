import { and, eq, isNull, sql } from 'drizzle-orm';

import { getCharacter, getProfile, listActiveHabits, listEquippedGear } from '../queries/hero';
import { getSettings, updateSettings } from '../queries/settings';
import { completions, habits, partyMembers } from '../schema';
import { seedDemo } from '../seed-demo';
import { LOCAL_USER_ID, type AppDb } from '../types';
import { counterIds, createTestDb } from '../../test/test-db';

// Tuesday 20 October 2026, 18:00 in Toronto.
const NOW = Date.parse('2026-10-20T22:00:00Z');
const TZ = 'America/Toronto';

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
});

describe('settings', () => {
  it('creates the defaults on first read and keeps one row', () => {
    expect(getSettings(db)).toEqual({
      id: 1,
      reduceMotion: 'system',
      onboardingDone: false,
      demoMode: false,
      localOnly: false,
    });
    expect(updateSettings(db, { reduceMotion: 'on' }).reduceMotion).toBe('on');
    expect(getSettings(db).reduceMotion).toBe('on');
  });
});

describe('schema rules', () => {
  beforeEach(() => seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() }));

  it('allows only one active completion per habit per day', () => {
    const [water] = listActiveHabits(db, LOCAL_USER_ID);
    const duplicate = {
      id: 'dup',
      userId: LOCAL_USER_ID,
      habitId: water!.id,
      localDate: '2026-10-20',
      completedAt: '2026-10-20T23:00:00.000Z',
      category: 'health' as const,
      xpAwarded: 10,
      goldAwarded: 3,
      bossDamage: 10,
    };
    expect(() => db.insert(completions).values(duplicate).run()).toThrow(/UNIQUE/);

    // After an undo, the same habit can be completed again that day.
    db.update(completions)
      .set({ undoneAt: '2026-10-20T22:30:00.000Z' })
      .where(and(eq(completions.habitId, water!.id), eq(completions.localDate, '2026-10-20')))
      .run();
    expect(() => db.insert(completions).values(duplicate).run()).not.toThrow();
  });
});

describe('demo seed', () => {
  beforeEach(() => seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() }));

  it('creates the canvas hero and turns on demo mode', () => {
    expect(getProfile(db, LOCAL_USER_ID)).toMatchObject({
      heroName: 'Sir Commit',
      heroClass: 'knight',
      timezone: TZ,
    });
    expect(getCharacter(db, LOCAL_USER_ID)).toMatchObject({
      level: 7,
      xpInLevel: 340,
      hp: 42,
      gold: 128,
      currentStreak: 12,
      lastClosedDate: '2026-10-19',
    });
    expect(getSettings(db)).toMatchObject({ demoMode: true, onboardingDone: true });
    expect(listEquippedGear(db, LOCAL_USER_ID)).toEqual(['iron-sword']);
  });

  it('lists the five sample quests in order', () => {
    expect(listActiveHabits(db, LOCAL_USER_ID).map((h) => h.name)).toEqual([
      'Drink 8 glasses of water',
      'Code for 1 hour',
      '30 min workout',
      'Read 20 pages',
      'No doomscrolling after 11pm',
    ]);
  });

  it('marks two of today’s quests done, like the canvas', () => {
    const today = db
      .select()
      .from(completions)
      .where(and(eq(completions.localDate, '2026-10-20'), isNull(completions.undoneAt)))
      .all();
    expect(today).toHaveLength(2);
  });

  it('has a completion on each of the last 12 days, backing the 12-day streak', () => {
    const days = db
      .select({ day: completions.localDate })
      .from(completions)
      .where(sql`${completions.localDate} between '2026-10-08' and '2026-10-19'`)
      .groupBy(completions.localDate)
      .all();
    expect(days).toHaveLength(12);
  });

  it('hides archived and deleted habits', () => {
    const [first, second] = listActiveHabits(db, LOCAL_USER_ID);
    db.update(habits).set({ archivedAt: 'x' }).where(eq(habits.id, first!.id)).run();
    db.update(habits).set({ deletedAt: 'x' }).where(eq(habits.id, second!.id)).run();
    expect(listActiveHabits(db, LOCAL_USER_ID)).toHaveLength(3);
  });

  it('replaces existing data when run again', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() });
    expect(listActiveHabits(db, LOCAL_USER_ID)).toHaveLength(5);
    expect(db.select().from(partyMembers).all()).toHaveLength(4);
  });
});
