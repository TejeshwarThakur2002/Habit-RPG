import { describe, expect, it } from 'vitest';

import { ALL_WEEKDAYS } from './dates.ts';
import {
  MAX_REMINDERS,
  parseTime,
  upcomingReminders,
  zonedInstant,
  type ReminderHabit,
} from './reminders.ts';

const TORONTO = 'America/Toronto';
const iso = (at: number) => new Date(at).toISOString();

describe('parseTime', () => {
  it('reads 24-hour HH:MM times', () => {
    expect(parseTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('rejects anything else', () => {
    for (const bad of ['7:30', '24:00', '12:60', 'noon', '']) expect(parseTime(bad)).toBeNull();
  });
});

describe('zonedInstant', () => {
  it('uses the zone, not the phone', () => {
    expect(iso(zonedInstant('2026-10-20', 9, 0, TORONTO))).toBe('2026-10-20T13:00:00.000Z');
    expect(iso(zonedInstant('2026-10-20', 9, 0, 'Pacific/Auckland'))).toBe(
      '2026-10-19T20:00:00.000Z',
    );
  });

  it('follows the offset on the day clocks fall back', () => {
    expect(iso(zonedInstant('2026-11-01', 9, 0, TORONTO))).toBe('2026-11-01T14:00:00.000Z');
    // 01:30 happens twice; the first one counts.
    expect(iso(zonedInstant('2026-11-01', 1, 30, TORONTO))).toBe('2026-11-01T05:30:00.000Z');
  });

  it('moves a time skipped when clocks spring forward to the hour after', () => {
    // 02:30 doesn't exist in Toronto on 8 March 2026; 03:30 EDT does.
    expect(iso(zonedInstant('2026-03-08', 2, 30, TORONTO))).toBe('2026-03-08T07:30:00.000Z');
    expect(iso(zonedInstant('2026-03-08', 9, 0, TORONTO))).toBe('2026-03-08T13:00:00.000Z');
  });
});

describe('upcomingReminders', () => {
  // Tuesday 20 October 2026, 10:00 in Toronto.
  const NOW = Date.parse('2026-10-20T14:00:00Z');
  const habit = (overrides: Partial<ReminderHabit>): ReminderHabit => ({
    id: 'water',
    type: 'daily',
    weekdays: ALL_WEEKDAYS,
    reminderTime: '20:00',
    ...overrides,
  });
  const notDone = () => false;

  it('books one reminder a day for the next 7 days, soonest first', () => {
    const reminders = upcomingReminders([habit({})], notDone, NOW, TORONTO);
    expect(reminders.map((r) => r.date)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(iso(reminders[0]!.at)).toBe('2026-10-21T00:00:00.000Z');
  });

  it('skips a time that has already passed today', () => {
    const reminders = upcomingReminders([habit({ reminderTime: '09:00' })], notDone, NOW, TORONTO);
    expect(reminders[0]?.date).toBe('2026-10-21');
    expect(reminders).toHaveLength(6);
  });

  it('skips a day the quest is already done', () => {
    const isDone = (id: string, date: string) => id === 'water' && date === '2026-10-20';
    const reminders = upcomingReminders([habit({})], isDone, NOW, TORONTO);
    expect(reminders[0]?.date).toBe('2026-10-21');
  });

  it('only reminds on scheduled days', () => {
    const mondays = habit({ type: 'weekdays', weekdays: 1 });
    expect(upcomingReminders([mondays], notDone, NOW, TORONTO).map((r) => r.date)).toEqual([
      '2026-10-26',
    ]);
  });

  it('ignores quests without a valid reminder time', () => {
    const quiet = [habit({ reminderTime: null }), habit({ id: 'bad', reminderTime: '25:00' })];
    expect(upcomingReminders(quiet, notDone, NOW, TORONTO)).toEqual([]);
  });

  it('stays under the phone limit, keeping the soonest', () => {
    const many = Array.from({ length: 10 }, (_, i) => habit({ id: `h${i}` }));
    const reminders = upcomingReminders(many, notDone, NOW, TORONTO);
    expect(reminders).toHaveLength(MAX_REMINDERS);
    expect(reminders.at(-1)?.date).toBe('2026-10-25');
  });
});
