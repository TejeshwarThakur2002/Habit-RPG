// Closing one local day for one user (SCOPE.md sections 3 and 9.3). Pure: the caller loads the
// habits and completions, applies the result with applyHpChange and closeDayStreak, and writes
// the day_closures row that makes the job idempotent.

import { baseValues, type Difficulty } from './constants';
import { isScheduledOn, type LocalDate, type Schedule } from './dates';

export interface ClosingHabit extends Schedule {
  id: string;
  difficulty: Difficulty;
  createdDate: LocalDate;
  archivedDate?: LocalDate | null;
  deletedDate?: LocalDate | null;
}

export interface MissedHabit {
  habitId: string;
  hpLoss: number;
  /** True when gear (Oak Shield) absorbed this miss. */
  blocked: boolean;
  /** A "don't" quest left unclaimed counts as a slip rather than a missed habit. */
  slip: boolean;
}

export interface DayCloseInput {
  date: LocalDate;
  habits: readonly ClosingHabit[];
  /** Habits with an active (not undone) completion on `date`. */
  completedHabitIds: ReadonlySet<string>;
  /** How many missed habits gear may absorb today (SCOPE.md section 3, Oak Shield). */
  missesToBlock?: number;
}

export interface DayCloseResult {
  date: LocalDate;
  missed: MissedHabit[];
  /** Total HP to take, after blocked misses. */
  hpLost: number;
  completionCount: number;
}

/** A habit counts on `date` if it existed and was neither archived nor deleted by then. */
export function isActiveOn(habit: ClosingHabit, date: LocalDate): boolean {
  const removed = [habit.archivedDate, habit.deletedDate].some((d) => d != null && d <= date);
  return habit.createdDate <= date && !removed;
}

export function closeDay(input: DayCloseInput): DayCloseResult {
  const { date, habits, completedHabitIds } = input;

  const missed: MissedHabit[] = habits
    .filter((h) => isActiveOn(h, date) && isScheduledOn(h, date) && !completedHabitIds.has(h.id))
    .map((h) => ({
      habitId: h.id,
      hpLoss: baseValues(h.type, h.difficulty).hpLoss,
      blocked: false,
      slip: h.type === 'bad',
    }));

  // The shield blocks the costliest missed habits first; slips are never blocked (D11).
  const blockable = missed.filter((m) => !m.slip).sort((a, b) => b.hpLoss - a.hpLoss);
  for (const miss of blockable.slice(0, Math.max(0, input.missesToBlock ?? 0))) {
    miss.blocked = true;
  }

  return {
    date,
    missed,
    hpLost: missed.reduce((sum, m) => sum + (m.blocked ? 0 : m.hpLoss), 0),
    completionCount: completedHabitIds.size,
  };
}

/**
 * HP to give back when a completion for an already-closed day arrives late: that day's
 * penalty for the habit is voided (SCOPE.md section 3, "Late sync").
 */
export function voidedPenalty(missed: readonly MissedHabit[], habitId: string): number {
  const miss = missed.find((m) => m.habitId === habitId);
  return miss && !miss.blocked ? miss.hpLoss : 0;
}
