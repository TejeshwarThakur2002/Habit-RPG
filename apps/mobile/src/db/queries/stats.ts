// The Stats tab (SCOPE.md F6), computed from local data only so it works offline.

import {
  addDays,
  completionRate,
  habitStreak,
  heatmapCounts,
  heatmapSummary,
  monthStart,
  type LocalDate,
} from '@habit-rpg/game-core';
import { and, eq, gte, isNotNull, isNull } from 'drizzle-orm';

import { bossWeeks, completions, habits, partyMembers } from '../schema';
import type { AppDb } from '../types';
import { toClosingHabits } from './day-close';
import { getCharacter, getProfile } from './hero';

export interface HabitRate {
  habitId: string;
  name: string;
  /** Last 30 days, or null if the habit wasn't scheduled in that time. */
  percent: number | null;
  /** Consecutive scheduled days completed, for the habit's detail. */
  streak: number;
}

export interface Stats {
  streak: number;
  monthPercent: number | null;
  bossesBeaten: number;
  heatmap: number[];
  heatmapSummary: string;
  /** Up to 5 quests: the best and worst last-30-day rates. */
  habitRates: HabitRate[];
}

const RATE_DAYS = 30;
const HEATMAP_LOOKBACK_DAYS = 12 * 7 + 7;

export function getStats(db: AppDb, userId: string, today: LocalDate): Stats | null {
  const profile = getProfile(db, userId);
  const character = getCharacter(db, userId);
  if (!profile || !character) return null;

  const rows = db.select().from(habits).where(eq(habits.userId, userId)).all();
  const closing = toClosingHabits(rows, profile.timezone);
  const doneDates = completedDates(db, userId, addDays(today, -HEATMAP_LOOKBACK_DAYS));
  const isDone = (habitId: string, date: LocalDate) => doneDates.get(habitId)?.has(date) ?? false;

  const countByDate = new Map<LocalDate, number>();
  for (const dates of doneDates.values()) {
    for (const date of dates) countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }
  const heatmap = heatmapCounts(countByDate, today);

  const active = closing.filter((h) => !h.archivedDate && !h.deletedDate);
  const rates = active.map((habit) => ({
    habitId: habit.id,
    name: rows.find((r) => r.id === habit.id)?.name ?? '',
    percent: completionRate([habit], isDone, addDays(today, 1 - RATE_DAYS), today).percent,
    streak: habitStreak(habit, doneDates.get(habit.id) ?? new Set(), today),
  }));

  return {
    streak: character.currentStreak,
    monthPercent: completionRate(closing, isDone, monthStart(today), today).percent,
    bossesBeaten: bossesBeaten(db, userId),
    heatmap,
    heatmapSummary: heatmapSummary(heatmap),
    habitRates: bestAndWorst(rates),
  };
}

/** Dates with an active completion, per habit, from `since` on. */
function completedDates(db: AppDb, userId: string, since: LocalDate) {
  const rows = db
    .select({ habitId: completions.habitId, date: completions.localDate })
    .from(completions)
    .where(
      and(
        eq(completions.userId, userId),
        isNull(completions.undoneAt),
        gte(completions.localDate, since),
      ),
    )
    .all();
  const byHabit = new Map<string, Set<LocalDate>>();
  for (const row of rows) {
    const set = byHabit.get(row.habitId) ?? new Set<LocalDate>();
    set.add(row.date);
    byHabit.set(row.habitId, set);
  }
  return byHabit;
}

function bossesBeaten(db: AppDb, userId: string): number {
  return db
    .select({ id: bossWeeks.id })
    .from(bossWeeks)
    .innerJoin(partyMembers, eq(partyMembers.partyId, bossWeeks.partyId))
    .where(and(eq(partyMembers.userId, userId), isNotNull(bossWeeks.defeatedAt)))
    .all().length;
}

/**
 * Highest rate first. With more than 5 quests, the top 3 and the bottom 2, so the screen shows
 * both what's going well and what needs attention (SCOPE.md section 5.7, item 4).
 */
export function bestAndWorst(rates: HabitRate[]): HabitRate[] {
  const sorted = [...rates].sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  return sorted.length <= 5 ? sorted : [...sorted.slice(0, 3), ...sorted.slice(-2)];
}
