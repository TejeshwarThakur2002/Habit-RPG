import { describe, expect, it } from 'vitest';

import type { ClosingHabit } from './day-close.ts';
import {
  HEATMAP_DAYS,
  completionRate,
  heatmapCounts,
  heatmapSummary,
  monthStart,
} from './stats.ts';

const habit = (overrides: Partial<ClosingHabit> & { id: string }): ClosingHabit => ({
  type: 'daily',
  difficulty: 'medium',
  weekdays: 127,
  createdDate: '2026-10-01',
  ...overrides,
});

// Thursday 22 October 2026.
const TODAY = '2026-10-22';
const doneOn =
  (pairs: string[]) =>
  (habitId: string, date: string): boolean =>
    pairs.includes(`${habitId}|${date}`);

describe('completionRate', () => {
  it('counts scheduled days up to today, and today only once done', () => {
    const read = habit({ id: 'read' });
    const rate = completionRate(
      [read],
      doneOn(['read|2026-10-20', 'read|2026-10-21']),
      '2026-10-20',
      TODAY,
    );
    // The 20th and 21st are done; the 22nd is not done yet, so it isn't counted.
    expect(rate).toEqual({ done: 2, scheduled: 2, percent: 100 });

    const withToday = completionRate([read], doneOn(['read|2026-10-22']), '2026-10-20', TODAY);
    expect(withToday).toEqual({ done: 1, scheduled: 3, percent: 33 });
  });

  it('skips days a habit is not scheduled, did not exist yet, or was archived', () => {
    const mondays = habit({ id: 'swim', type: 'weekdays', weekdays: 1 }); // the 19th
    const newer = habit({ id: 'new', createdDate: '2026-10-21' });
    const archived = habit({ id: 'old', archivedDate: '2026-10-20' });
    const rate = completionRate(
      [mondays, newer, archived],
      doneOn(['swim|2026-10-19', 'new|2026-10-21', 'old|2026-10-19']),
      '2026-10-19',
      '2026-10-21',
    );
    // swim on the 19th, new on the 21st, old on the 19th only: 3 scheduled, 3 done.
    expect(rate).toEqual({ done: 3, scheduled: 3, percent: 100 });
  });

  it('has no percent when nothing was scheduled', () => {
    expect(completionRate([], doneOn([]), '2026-10-01', TODAY)).toEqual({
      done: 0,
      scheduled: 0,
      percent: null,
    });
  });
});

describe('monthStart', () => {
  it('is the first of the month', () => {
    expect(monthStart(TODAY)).toBe('2026-10-01');
  });
});

describe('heatmapCounts', () => {
  it('lays out 12 Monday-first weeks ending with this week', () => {
    const counts = heatmapCounts(
      new Map([
        ['2026-08-03', 2], // the first Monday shown
        ['2026-08-02', 9], // the Sunday before: too old
        [TODAY, 4],
        ['2026-10-23', 7], // tomorrow: not yet
      ]),
      TODAY,
    );
    expect(counts).toHaveLength(HEATMAP_DAYS);
    expect(counts[0]).toBe(2);
    // Thursday of the last week.
    expect(counts[11 * 7 + 3]).toBe(4);
    expect(counts[11 * 7 + 4]).toBe(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6);
  });
});

describe('heatmapSummary', () => {
  it('counts the weeks with at least 5 active days', () => {
    const strong = [1, 1, 1, 1, 1, 0, 0];
    const weak = [1, 0, 0, 0, 0, 0, 3];
    expect(heatmapSummary([...strong, ...weak, ...strong])).toBe(
      '2 of the last 12 weeks had 5 or more active days',
    );
  });
});
