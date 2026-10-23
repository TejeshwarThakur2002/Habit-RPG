import { describe, expect, it } from 'vitest';

import { closeDay, isActiveOn, voidedPenalty, type ClosingHabit } from './day-close.ts';
import { closeDayStreak, habitStreak } from './streaks.ts';

const habit = (overrides: Partial<ClosingHabit> & { id: string }): ClosingHabit => ({
  type: 'daily',
  difficulty: 'medium',
  weekdays: 127,
  createdDate: '2026-10-01',
  ...overrides,
});

// 2026-10-20 is a Tuesday.
const DAY = '2026-10-20';
const water = habit({ id: 'water', difficulty: 'easy' });
const workout = habit({ id: 'workout', difficulty: 'hard' });
const code = habit({ id: 'code' });
const scroll = habit({ id: 'scroll', type: 'bad', difficulty: 'easy' });
const mondays = habit({ id: 'mondays', type: 'weekdays', weekdays: 1 });

describe('closeDay', () => {
  it('charges HP for every scheduled habit left undone', () => {
    const result = closeDay({
      date: DAY,
      habits: [water, workout, code],
      completedHabitIds: new Set(['code']),
    });
    expect(result.missed.map((m) => [m.habitId, m.hpLoss])).toEqual([
      ['water', 4],
      ['workout', 8],
    ]);
    expect(result.hpLost).toBe(12);
    expect(result.completionCount).toBe(1);
  });

  it('counts an unclaimed "don\'t" quest as an 8 HP slip', () => {
    const result = closeDay({ date: DAY, habits: [scroll], completedHabitIds: new Set() });
    expect(result.missed).toEqual([{ habitId: 'scroll', hpLoss: 8, blocked: false, slip: true }]);
  });

  it('ignores habits not scheduled that day', () => {
    const result = closeDay({ date: DAY, habits: [mondays], completedHabitIds: new Set() });
    expect(result).toMatchObject({ missed: [], hpLost: 0 });
  });

  it('ignores habits created after the day or archived or deleted by then', () => {
    const habits = [
      habit({ id: 'new', createdDate: '2026-10-21' }),
      habit({ id: 'archived', archivedDate: '2026-10-20' }),
      habit({ id: 'deleted', deletedDate: '2026-10-19' }),
      habit({ id: 'archived-later', archivedDate: '2026-10-22' }),
    ];
    const result = closeDay({ date: DAY, habits, completedHabitIds: new Set() });
    expect(result.missed.map((m) => m.habitId)).toEqual(['archived-later']);
  });

  it('lets the shield block the costliest missed habit, never a slip', () => {
    const result = closeDay({
      date: DAY,
      habits: [water, workout, scroll],
      completedHabitIds: new Set(),
      missesToBlock: 1,
    });
    expect(result.missed.find((m) => m.blocked)?.habitId).toBe('workout');
    expect(result.hpLost).toBe(4 + 8);
  });

  it('treats a negative block count as none', () => {
    const result = closeDay({
      date: DAY,
      habits: [water],
      completedHabitIds: new Set(),
      missesToBlock: -1,
    });
    expect(result.hpLost).toBe(4);
  });

  it('closes a 23-hour daylight-saving day like any other day', () => {
    const older = habit({ id: 'older', createdDate: '2026-01-01' });
    const result = closeDay({ date: '2026-03-08', habits: [older], completedHabitIds: new Set() });
    expect(result.hpLost).toBe(6);
  });
});

describe('isActiveOn', () => {
  it('counts a habit from its creation day', () => {
    expect(isActiveOn(habit({ id: 'x', createdDate: DAY }), DAY)).toBe(true);
    expect(isActiveOn(habit({ id: 'x', archivedDate: null, deletedDate: null }), DAY)).toBe(true);
  });
});

describe('voidedPenalty', () => {
  const { missed } = closeDay({
    date: DAY,
    habits: [water, workout],
    completedHabitIds: new Set(),
    missesToBlock: 1,
  });

  it('refunds a late-synced habit’s penalty', () => {
    expect(voidedPenalty(missed, 'water')).toBe(4);
  });

  it('refunds nothing for a blocked miss or a habit that was not missed', () => {
    expect(voidedPenalty(missed, 'workout')).toBe(0);
    expect(voidedPenalty(missed, 'code')).toBe(0);
  });
});

describe('closeDayStreak', () => {
  it('extends the streak on a day with any completion', () => {
    expect(closeDayStreak({ current: 11, longest: 11 }, 2)).toEqual({ current: 12, longest: 12 });
  });

  it('resets on a day with none but keeps the longest', () => {
    expect(closeDayStreak({ current: 12, longest: 20 }, 0)).toEqual({ current: 0, longest: 20 });
  });
});

describe('habitStreak', () => {
  const done = (...dates: string[]) => new Set(dates);

  it('counts consecutive completed days up to today', () => {
    expect(habitStreak(code, done('2026-10-18', '2026-10-19', DAY), DAY)).toBe(3);
  });

  it('does not break the streak because today is not done yet', () => {
    expect(habitStreak(code, done('2026-10-18', '2026-10-19'), DAY)).toBe(2);
  });

  it('stops at the first missed scheduled day', () => {
    expect(habitStreak(code, done('2026-10-17', '2026-10-19'), DAY)).toBe(1);
  });

  it('skips days the habit was not scheduled', () => {
    // Monday-only habit: done on 12 and 19 October, today is Tuesday the 20th.
    expect(habitStreak(mondays, done('2026-10-12', '2026-10-19'), DAY)).toBe(2);
  });

  it('never counts before the habit existed', () => {
    const fresh = habit({ id: 'fresh', createdDate: '2026-10-19' });
    expect(habitStreak(fresh, done('2026-10-19', DAY), DAY)).toBe(2);
  });
});
