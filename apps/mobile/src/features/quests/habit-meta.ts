import { BAD_HABIT_VALUES, type Difficulty } from '@habit-rpg/game-core';

import type { Habit } from '@/db/queries/hero';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DIFFICULTY: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** "Mon, Wed, Fri" from the weekday bitmask (Monday = 1 ... Sunday = 64). */
export function weekdayList(mask: number): string {
  return DAY_NAMES.filter((_, i) => mask & (1 << i)).join(', ');
}

/** The line under a quest's name, as in the design canvas: "Daily · Medium". */
export function habitMeta(habit: Pick<Habit, 'type' | 'difficulty' | 'weekdays'>): string {
  if (habit.type === 'bad') return `Bad habit · lose ${BAD_HABIT_VALUES.hpLoss} HP if broken`;
  const when = habit.type === 'daily' ? 'Daily' : weekdayList(habit.weekdays);
  return `${when} · ${DIFFICULTY[habit.difficulty]}`;
}
