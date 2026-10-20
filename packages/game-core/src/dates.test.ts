import { describe, expect, it } from 'vitest';

import {
  addDays,
  datesToClose,
  daysBetween,
  isCompletionDateAllowed,
  isScheduledOn,
  latestClosableDate,
  localDate,
  localDateTime,
  weekday,
} from './dates';

const LA = 'America/Los_Angeles';
const AKL = 'Pacific/Auckland';
const at = (iso: string) => Date.parse(iso);

describe('localDateTime', () => {
  it('gives far-apart zones different dates for the same instant', () => {
    const now = at('2026-10-20T12:00:00Z');
    expect(localDateTime(now, LA)).toEqual({ date: '2026-10-20', hour: 5, minute: 0 });
    expect(localDateTime(now, AKL)).toEqual({ date: '2026-10-21', hour: 1, minute: 0 });
  });

  it('follows daylight saving: Los Angeles is UTC-8 before 8 March 2026 and UTC-7 after', () => {
    expect(localDateTime(at('2026-03-08T09:30:00Z'), LA).hour).toBe(1);
    expect(localDateTime(at('2026-03-08T10:30:00Z'), LA).hour).toBe(3);
  });
});

describe('calendar arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts a daylight-saving weekend as whole days', () => {
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-11-02', '2026-10-31')).toBe(-2);
  });

  it('numbers weekdays Monday = 1 to Sunday = 7', () => {
    expect(weekday('2026-10-19')).toBe(1);
    expect(weekday('2026-10-20')).toBe(2);
    expect(weekday('2026-10-25')).toBe(7);
  });
});

describe('isScheduledOn', () => {
  const monWedFri = 1 | 4 | 16;

  it('runs daily habits every day, whatever the bitmask', () => {
    expect(isScheduledOn({ type: 'daily', weekdays: 0 }, '2026-10-20')).toBe(true);
  });

  it('runs weekday habits only on their days', () => {
    expect(isScheduledOn({ type: 'weekdays', weekdays: monWedFri }, '2026-10-19')).toBe(true);
    expect(isScheduledOn({ type: 'weekdays', weekdays: monWedFri }, '2026-10-20')).toBe(false);
    expect(isScheduledOn({ type: 'weekdays', weekdays: monWedFri }, '2026-10-23')).toBe(true);
    expect(isScheduledOn({ type: 'weekdays', weekdays: 64 }, '2026-10-25')).toBe(true);
  });

  it('runs "don\'t" quests on their bitmask days', () => {
    expect(isScheduledOn({ type: 'bad', weekdays: 127 }, '2026-10-24')).toBe(true);
    expect(isScheduledOn({ type: 'bad', weekdays: 0 }, '2026-10-24')).toBe(false);
  });
});

describe('latestClosableDate (day D closes at 03:00 on D + 1)', () => {
  it('closes yesterday after 03:00 and waits before it', () => {
    expect(latestClosableDate(at('2026-10-20T10:00:00Z'), LA)).toBe('2026-10-19');
    expect(latestClosableDate(at('2026-10-20T09:00:00Z'), LA)).toBe('2026-10-18');
  });

  it('handles the spring-forward night in Los Angeles (8 March 2026)', () => {
    expect(latestClosableDate(at('2026-03-08T09:30:00Z'), LA)).toBe('2026-03-06');
    expect(latestClosableDate(at('2026-03-08T10:30:00Z'), LA)).toBe('2026-03-07');
  });

  it('handles the fall-back night in Los Angeles (1 November 2026)', () => {
    // 01:00-02:00 happens twice; 03:00 PST is 11:00 UTC.
    expect(latestClosableDate(at('2026-11-01T10:30:00Z'), LA)).toBe('2026-10-30');
    expect(latestClosableDate(at('2026-11-01T11:30:00Z'), LA)).toBe('2026-10-31');
  });

  it('handles both daylight-saving changes in Auckland', () => {
    expect(latestClosableDate(at('2026-04-05T14:30:00Z'), AKL)).toBe('2026-04-04');
    expect(latestClosableDate(at('2026-04-05T15:30:00Z'), AKL)).toBe('2026-04-05');
    expect(latestClosableDate(at('2026-09-27T13:30:00Z'), AKL)).toBe('2026-09-26');
    expect(latestClosableDate(at('2026-09-27T14:30:00Z'), AKL)).toBe('2026-09-27');
  });

  it('closes the same date for users on opposite sides of the date line at one instant', () => {
    const now = at('2026-10-20T12:00:00Z');
    expect(latestClosableDate(now, LA)).toBe('2026-10-19'); // 05:00 on the 20th
    expect(latestClosableDate(now, AKL)).toBe('2026-10-19'); // 01:00 on the 21st
  });
});

describe('datesToClose', () => {
  const now = at('2026-10-19T12:00:00Z'); // 05:00 on 19 October in Los Angeles

  it('catches up every missed day in order after a 3-day outage', () => {
    expect(datesToClose(now, LA, '2026-10-15', '2026-10-01')).toEqual([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });

  it('returns nothing when everything is already closed', () => {
    expect(datesToClose(now, LA, '2026-10-18', '2026-10-01')).toEqual([]);
  });

  it('starts from the first day for a user who has never had a day closed', () => {
    expect(datesToClose(now, LA, null, '2026-10-18')).toEqual(['2026-10-18']);
  });
});

describe('isCompletionDateAllowed', () => {
  const now = at('2026-10-20T12:00:00Z');

  it('accepts two days back to one day ahead in the user zone', () => {
    expect(localDate(now, LA)).toBe('2026-10-20');
    expect(isCompletionDateAllowed('2026-10-18', now, LA)).toBe(true);
    expect(isCompletionDateAllowed('2026-10-21', now, LA)).toBe(true);
    expect(isCompletionDateAllowed('2026-10-17', now, LA)).toBe(false);
    expect(isCompletionDateAllowed('2026-10-22', now, LA)).toBe(false);
  });

  it('uses the user zone, not UTC', () => {
    expect(isCompletionDateAllowed('2026-10-22', now, AKL)).toBe(true);
    expect(isCompletionDateAllowed('2026-10-18', now, AKL)).toBe(false);
  });
});
