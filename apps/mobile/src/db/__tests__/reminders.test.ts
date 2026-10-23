import { completeHabit } from '../queries/completions';
import {
  archiveHabit,
  createHabit,
  getHabit,
  updateHabit,
  type HabitFields,
} from '../queries/habits';
import { createHero, resetLocalData } from '../queries/local-data';
import { getReminderPlan } from '../queries/reminders';
import { LOCAL_USER_ID, type AppDb } from '../types';
import { createTestDb } from '../../test/test-db';

// Tuesday 20 October 2026, 10:00 in Toronto.
const NOW = Date.parse('2026-10-20T14:00:00Z');
const user = LOCAL_USER_ID;

const fields = (overrides: Partial<HabitFields> = {}): HabitFields => ({
  name: 'Drink water',
  type: 'daily',
  difficulty: 'easy',
  category: 'health',
  weekdays: 127,
  reminderTime: '20:00',
  ...overrides,
});

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
  createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: 'America/Toronto', now: NOW });
  createHabit(db, { userId: user, id: 'water', now: NOW, fields: fields() });
});

describe('getReminderPlan', () => {
  it('saves the reminder time and books the next 7 evenings with the quest name', () => {
    expect(getHabit(db, user, 'water')?.reminderTime).toBe('20:00');
    const plan = getReminderPlan(db, user, NOW);
    expect(plan).toHaveLength(7);
    expect(plan[0]).toMatchObject({
      habitId: 'water',
      date: '2026-10-20',
      habitName: 'Drink water',
    });
    expect(new Date(plan[0]!.at).toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it("drops today's reminder once the quest is done", () => {
    completeHabit(db, { userId: user, habitId: 'water', now: NOW, newId: () => 'c1' });
    expect(getReminderPlan(db, user, NOW)[0]?.date).toBe('2026-10-21');
  });

  it('clears reminders when they are turned off or the quest is archived', () => {
    updateHabit(db, user, 'water', NOW, fields({ reminderTime: null }));
    expect(getReminderPlan(db, user, NOW)).toEqual([]);

    updateHabit(db, user, 'water', NOW, fields());
    archiveHabit(db, user, 'water', NOW);
    expect(getReminderPlan(db, user, NOW)).toEqual([]);
  });

  it('is empty once signed out', () => {
    resetLocalData(db);
    expect(getReminderPlan(db, user, NOW)).toEqual([]);
  });
});
