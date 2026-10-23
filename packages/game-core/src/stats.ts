// Numbers for the Stats screen (SCOPE.md F6), from local data only. Pure: callers pass the
// habits, which (habit, day) pairs were completed, and today.

import { addDays, isScheduledOn, weekday, type LocalDate } from './dates';
import { isActiveOn, type ClosingHabit } from './day-close';

/** True when `habitId` has an active (not undone) completion on `date`. */
export type IsDone = (habitId: string, date: LocalDate) => boolean;

export interface Rate {
  done: number;
  scheduled: number;
  /** Whole percent, or null when nothing was scheduled (shown as "–"). */
  percent: number | null;
}

/**
 * The share of scheduled quests completed from `from` to `today`. Today only counts the
 * quests already done, so an unfinished morning doesn't drag the rate down.
 */
export function completionRate(
  habits: readonly ClosingHabit[],
  isDone: IsDone,
  from: LocalDate,
  today: LocalDate,
): Rate {
  let done = 0;
  let scheduled = 0;
  for (let date = from; date <= today; date = addDays(date, 1)) {
    for (const habit of habits) {
      if (!isActiveOn(habit, date) || !isScheduledOn(habit, date)) continue;
      const hit = isDone(habit.id, date);
      if (date === today && !hit) continue;
      scheduled += 1;
      if (hit) done += 1;
    }
  }
  return {
    done,
    scheduled,
    percent: scheduled === 0 ? null : Math.round((done / scheduled) * 100),
  };
}

/** The first day of `today`'s month. */
export function monthStart(today: LocalDate): LocalDate {
  return `${today.slice(0, 7)}-01`;
}

export const HEATMAP_DAYS = 12 * 7;

/**
 * Completions per day for the 12 weeks ending with this week, Monday first and oldest first,
 * the layout `Heatmap` expects. Days after today count 0.
 */
export function heatmapCounts(
  countByDate: ReadonlyMap<LocalDate, number>,
  today: LocalDate,
): number[] {
  const thisMonday = addDays(today, 1 - weekday(today));
  const first = addDays(thisMonday, -77);
  return Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const date = addDays(first, i);
    return date > today ? 0 : (countByDate.get(date) ?? 0);
  });
}

/** For screen readers: "8 of the last 12 weeks had 5 or more active days". */
export function heatmapSummary(counts: readonly number[]): string {
  let strongWeeks = 0;
  for (let week = 0; week < counts.length / 7; week += 1) {
    const active = counts.slice(week * 7, week * 7 + 7).filter((n) => n > 0).length;
    if (active >= 5) strongWeeks += 1;
  }
  return `${strongWeeks} of the last 12 weeks had 5 or more active days`;
}
