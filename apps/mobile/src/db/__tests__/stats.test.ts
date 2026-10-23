import { counterIds, createTestDb } from '../../test/test-db';
import { createHabit, type HabitFields } from '../queries/habits';
import { createHero } from '../queries/local-data';
import { bestAndWorst, getStats } from '../queries/stats';
import { completions } from '../schema';
import { seedDemo } from '../seed-demo';
import { LOCAL_USER_ID, type AppDb } from '../types';

// Thursday 22 October 2026, 18:00 in Toronto.
const NOW = Date.parse('2026-10-22T22:00:00Z');
const TODAY = '2026-10-22';
const TZ = 'America/Toronto';
const user = LOCAL_USER_ID;

let db: AppDb;
let newId: () => string;
beforeEach(async () => {
  db = await createTestDb();
  newId = counterIds();
});

const fields = (name: string): HabitFields => ({
  name,
  type: 'daily',
  difficulty: 'medium',
  category: 'mind',
  weekdays: 127,
  reminderTime: null,
});

function complete(habitId: string, date: string) {
  db.insert(completions)
    .values({
      id: newId(),
      userId: user,
      habitId,
      localDate: date,
      completedAt: `${date}T12:00:00.000Z`,
      category: 'mind',
      xpAwarded: 20,
      goldAwarded: 6,
      bossDamage: 20,
    })
    .run();
}

describe('getStats', () => {
  it('works out rates, streaks and the heatmap from local data', () => {
    // A hero who started on Monday the 19th with two daily quests.
    createHero(db, {
      heroName: 'Ada',
      heroClass: 'mage',
      timeZone: TZ,
      now: Date.parse('2026-10-19T16:00:00Z'),
    });
    createHabit(db, {
      userId: user,
      id: 'read',
      now: Date.parse('2026-10-19T16:00:00Z'),
      fields: fields('Read'),
    });
    createHabit(db, {
      userId: user,
      id: 'swim',
      now: Date.parse('2026-10-19T16:00:00Z'),
      fields: fields('Swim'),
    });
    for (const date of ['2026-10-19', '2026-10-20', '2026-10-21', TODAY]) complete('read', date);
    complete('swim', '2026-10-19');

    const stats = getStats(db, user, TODAY);
    // read: 4 of 4 (today done); swim: 1 of 3 (today not done yet, so not counted).
    expect(stats?.habitRates).toEqual([
      { habitId: 'read', name: 'Read', percent: 100, streak: 4 },
      { habitId: 'swim', name: 'Swim', percent: 33, streak: 0 },
    ]);
    expect(stats?.monthPercent).toBe(71); // 5 of 7
    expect(stats?.bossesBeaten).toBe(0);
    // Monday to Thursday of the last week.
    expect(stats?.heatmap.slice(77, 81)).toEqual([2, 1, 1, 1]);
    expect(stats?.heatmapSummary).toBe('0 of the last 12 weeks had 5 or more active days');
  });

  it('reads the demo hero without errors', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId });
    const stats = getStats(db, user, TODAY);
    expect(stats?.streak).toBe(12);
    expect(stats?.heatmap.some((n) => n > 0)).toBe(true);
    expect(stats?.habitRates.length).toBeGreaterThan(0);
  });

  it('is null before there is a hero', () => {
    expect(getStats(db, user, TODAY)).toBeNull();
  });
});

describe('bestAndWorst', () => {
  const rate = (habitId: string, percent: number | null) => ({
    habitId,
    name: habitId,
    percent,
    streak: 0,
  });

  it('keeps the top 3 and bottom 2 when there are more than 5', () => {
    const rates = [
      rate('a', 50),
      rate('b', 90),
      rate('c', null),
      rate('d', 10),
      rate('e', 70),
      rate('f', 30),
    ];
    expect(bestAndWorst(rates).map((r) => r.habitId)).toEqual(['b', 'e', 'a', 'd', 'c']);
  });
});
