// The reminders the phone should have booked right now (SCOPE.md F9). Pure scheduling rules
// are in game-core; this reads the hero's quests and today's and tomorrow's completions.

import { addDays, localDate, upcomingReminders, type Reminder } from '@habit-rpg/game-core';

import type { AppDb } from '../types';
import { getProfile, listActiveHabits } from './hero';
import { completedOn } from './quest-board';

export interface PlannedReminder extends Reminder {
  habitName: string;
}

/** Empty when there is no hero (signed out), which clears every booked reminder. */
export function getReminderPlan(db: AppDb, userId: string, now: number): PlannedReminder[] {
  const profile = getProfile(db, userId);
  if (!profile) return [];
  const habits = listActiveHabits(db, userId);
  const today = localDate(now, profile.timezone);
  // Completions are never dated later than tomorrow (section 3), so later days are all open.
  const done = new Map([today, addDays(today, 1)].map((d) => [d, completedOn(db, userId, d)]));
  const isDone = (habitId: string, date: string) => done.get(date)?.has(habitId) ?? false;
  const names = new Map(habits.map((h) => [h.id, h.name]));
  return upcomingReminders(habits, isDone, now, profile.timezone).map((r) => ({
    ...r,
    habitName: names.get(r.habitId) ?? 'Your quest',
  }));
}
