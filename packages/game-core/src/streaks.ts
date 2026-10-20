// Streaks (SCOPE.md section 3, "Streaks").

import { addDays, isScheduledOn, type LocalDate, type Schedule } from './dates';

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * The global streak at day close: a day with at least one completion extends it, a day with
 * none resets it to 0. The longest streak only ever grows (it drives LUCK).
 */
export function closeDayStreak(streaks: Streaks, completionCount: number): Streaks {
  const current = completionCount > 0 ? streaks.current + 1 : 0;
  return { current, longest: Math.max(streaks.longest, current) };
}

export interface StreakHabit extends Schedule {
  createdDate: LocalDate;
}

/**
 * A habit's own streak: consecutive scheduled days it was completed, counting back from
 * `today`. Unscheduled days are skipped. If today is scheduled but not done yet, the streak
 * is counted from yesterday, because today is still open.
 */
export function habitStreak(
  habit: StreakHabit,
  completedDates: ReadonlySet<LocalDate>,
  today: LocalDate,
): number {
  let date = today;
  if (isScheduledOn(habit, today) && !completedDates.has(today)) {
    date = addDays(today, -1);
  }

  let streak = 0;
  for (; date >= habit.createdDate; date = addDays(date, -1)) {
    if (!isScheduledOn(habit, date)) continue;
    if (!completedDates.has(date)) break;
    streak += 1;
  }
  return streak;
}
