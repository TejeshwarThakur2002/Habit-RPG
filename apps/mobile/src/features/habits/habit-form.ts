import { ALL_WEEKDAYS, parseTime } from '@habit-rpg/game-core';
import { z } from 'zod';

import type { Habit } from '@/db/queries/hero';
import type { HabitFields } from '@/db/queries/habits';
import { cleanText } from '@habit-rpg/shared';

// SCOPE.md F2: name required, at most 60 characters; weekdays only for "Weekdays" habits.
// Habit names appear in the party battle log, so they are cleaned like hero names (9.6).
export const habitFormSchema = z
  .object({
    name: z
      .string()
      .transform(cleanText)
      .pipe(z.string().min(1, 'Give your quest a name').max(60, 'Use at most 60 characters')),
    type: z.enum(['daily', 'weekdays', 'bad']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    category: z.enum(['body', 'mind', 'health', 'none']),
    weekdays: z.number().int().min(0).max(ALL_WEEKDAYS),
    // F9: an optional 'HH:MM' reminder in the hero's time zone.
    reminderTime: z
      .string()
      .refine((t) => parseTime(t) !== null, 'Pick a reminder time')
      .nullable(),
  })
  .refine((v) => v.type !== 'weekdays' || v.weekdays > 0, {
    path: ['weekdays'],
    message: 'Pick at least one day',
  })
  // Daily habits and "don't" quests run every day, whatever days were picked before.
  .transform((v): HabitFields => (v.type === 'weekdays' ? v : { ...v, weekdays: ALL_WEEKDAYS }));

export type HabitFormValues = z.input<typeof habitFormSchema>;

export const NEW_HABIT: HabitFormValues = {
  name: '',
  type: 'daily',
  difficulty: 'medium',
  category: 'none',
  weekdays: ALL_WEEKDAYS,
  reminderTime: null,
};

export function formValuesFor(habit: Habit): HabitFormValues {
  return {
    name: habit.name,
    type: habit.type,
    difficulty: habit.difficulty,
    category: habit.category,
    weekdays: habit.weekdays,
    reminderTime: habit.reminderTime,
  };
}
