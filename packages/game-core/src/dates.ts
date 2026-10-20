// Local-date helpers (SCOPE.md section 3, "Day close"). A "day" is a calendar date in the
// user's IANA time zone, written as 'YYYY-MM-DD'. Days are never computed with 24-hour
// arithmetic, so 23- and 25-hour daylight-saving days work. Uses only the built-in Intl API
// (Hermes and Deno both ship it), keeping game-core dependency-free (DECISIONS.md D11).

import type { HabitType } from './constants';

/** A calendar date, 'YYYY-MM-DD'. Plain string comparison orders these correctly. */
export type LocalDate = string;

export interface LocalDateTime {
  date: LocalDate;
  hour: number;
  minute: number;
}

/** Day D closes at 03:00 local time on D + 1. */
export const DAY_CLOSE_HOUR = 3;
/** A completion may be dated up to 2 days back (late sync) or 1 day ahead. */
export const MAX_DAYS_BACK = 2;
export const MAX_DAYS_AHEAD = 1;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The wall-clock date and time in `timeZone` at the instant `now` (epoch milliseconds). */
export function localDateTime(now: number, timeZone: string): LocalDateTime {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function localDate(now: number, timeZone: string): LocalDate {
  return localDateTime(now, timeZone).date;
}

// Calendar arithmetic on dates alone; UTC is used only as a time-zone-free calendar.
function toUtcMidnight(date: LocalDate): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const result = new Date(toUtcMidnight(date));
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / 86_400_000);
}

/** ISO weekday: Monday = 1 ... Sunday = 7. */
export function weekday(date: LocalDate): number {
  const day = new Date(toUtcMidnight(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Weekday bitmask as stored on habits: Monday = 1, Tuesday = 2, ... Sunday = 64. */
export const ALL_WEEKDAYS = 127;

export interface Schedule {
  type: HabitType;
  weekdays: number;
}

/** Daily habits run every day; weekday habits and "don't" quests follow their bitmask. */
export function isScheduledOn(habit: Schedule, date: LocalDate): boolean {
  if (habit.type === 'daily') return true;
  return (habit.weekdays & (1 << (weekday(date) - 1))) !== 0;
}

/** The latest day that has closed at `now`: yesterday after 03:00, otherwise two days ago. */
export function latestClosableDate(now: number, timeZone: string): LocalDate {
  const { date, hour } = localDateTime(now, timeZone);
  return addDays(date, hour >= DAY_CLOSE_HOUR ? -1 : -2);
}

/**
 * Days that still need closing, oldest first. Covers every day after `lastClosedDate` up to
 * the latest closable one, so a job that was down for several days catches up in order.
 * A user who has never had a day closed starts from `firstDate` (their sign-up day).
 */
export function datesToClose(
  now: number,
  timeZone: string,
  lastClosedDate: LocalDate | null,
  firstDate: LocalDate,
): LocalDate[] {
  const latest = latestClosableDate(now, timeZone);
  const dates: LocalDate[] = [];
  for (
    let date = lastClosedDate ? addDays(lastClosedDate, 1) : firstDate;
    date <= latest;
    date = addDays(date, 1)
  ) {
    dates.push(date);
  }
  return dates;
}

/** The server accepts completions dated from 2 days ago to tomorrow, in the user's zone. */
export function isCompletionDateAllowed(date: LocalDate, now: number, timeZone: string): boolean {
  const today = localDate(now, timeZone);
  const offset = daysBetween(today, date);
  return offset >= -MAX_DAYS_BACK && offset <= MAX_DAYS_AHEAD;
}
