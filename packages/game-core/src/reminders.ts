// Reminder schedule (SCOPE.md F9). The phone books one-off notifications for the next few
// days instead of repeating ones, so a quest already done today gets no reminder and times
// follow the hero's time zone rather than the phone's (DECISIONS.md D28).

import { addDays, isScheduledOn, localDateTime, type LocalDate, type Schedule } from './dates.ts';
import type { IsDone } from './stats.ts';

/** How far ahead reminders are booked; the app refreshes them on every change and open. */
export const REMINDER_DAYS = 7;
/** iOS keeps at most 64 pending local notifications; stay safely under it. */
export const MAX_REMINDERS = 60;

export interface ReminderHabit extends Schedule {
  id: string;
  /** 'HH:MM' in the hero's time zone, or null for no reminder. */
  reminderTime: string | null;
}

export interface Reminder {
  habitId: string;
  date: LocalDate;
  /** Epoch milliseconds when the notification should fire. */
  at: number;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parses 'HH:MM' (24-hour), or returns null when it isn't a valid time. */
export function parseTime(time: string): { hour: number; minute: number } | null {
  const match = TIME.exec(time);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function wallClockAsUtc(now: number, timeZone: string): number {
  const { date, hour, minute } = localDateTime(now, timeZone);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, hour, minute);
}

/**
 * The instant when the clock in `timeZone` shows `hour:minute` on `date`. The zone's offset
 * is measured at a first guess and again at the result, which handles daylight-saving days.
 * A time skipped when clocks spring forward (02:30) lands an hour later, as phones do.
 */
export function zonedInstant(
  date: LocalDate,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d, hour, minute);
  const guess = target - (wallClockAsUtc(target, timeZone) - target);
  const result = target - (wallClockAsUtc(guess, timeZone) - guess);
  // In the skipped hour no instant shows the target time; the first guess is the hour after.
  return wallClockAsUtc(result, timeZone) === target ? result : guess;
}

/**
 * Reminders for the next REMINDER_DAYS days, soonest first: one per quest with a reminder
 * time on each day it is scheduled, skipping quests already done that day and times that
 * have passed. Callers pass only active quests (not archived or deleted).
 */
export function upcomingReminders(
  habits: readonly ReminderHabit[],
  isDone: IsDone,
  now: number,
  timeZone: string,
): Reminder[] {
  const today = localDateTime(now, timeZone).date;
  const reminders: Reminder[] = [];
  for (let offset = 0; offset < REMINDER_DAYS; offset += 1) {
    const date = addDays(today, offset);
    for (const habit of habits) {
      const time = habit.reminderTime === null ? null : parseTime(habit.reminderTime);
      if (!time || !isScheduledOn(habit, date) || isDone(habit.id, date)) continue;
      const at = zonedInstant(date, time.hour, time.minute, timeZone);
      if (at > now) reminders.push({ habitId: habit.id, date, at });
    }
  }
  return reminders.sort((a, b) => a.at - b.at).slice(0, MAX_REMINDERS);
}
