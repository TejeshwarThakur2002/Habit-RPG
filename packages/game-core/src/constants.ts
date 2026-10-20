// Game constants from SCOPE.md section 3. Change them here only; app and server both read them.

export type HabitType = 'daily' | 'weekdays' | 'bad';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Category = 'body' | 'mind' | 'health' | 'none';
export type StatName = 'STR' | 'INT' | 'CON' | 'LUCK';
/** Cosmetic only in the MVP: sets the sprite and the title (SCOPE.md section 3). */
export type HeroClass = 'knight' | 'mage' | 'rogue';

export interface BaseValues {
  xp: number;
  gold: number;
  /** HP lost when the habit is missed (or, for a bad habit, broken). */
  hpLoss: number;
}

/** Section 3, "Habit types and difficulty". */
export const DIFFICULTY_VALUES: Readonly<Record<Difficulty, BaseValues>> = {
  easy: { xp: 10, gold: 3, hpLoss: 4 },
  medium: { xp: 20, gold: 6, hpLoss: 6 },
  hard: { xp: 30, gold: 9, hpLoss: 8 },
};

/** A "don't" quest has fixed values whatever its difficulty (DECISIONS.md D10). */
export const BAD_HABIT_VALUES: Readonly<BaseValues> = { xp: 5, gold: 2, hpLoss: 8 };

export const STREAK_BONUS_PER_DAY = 0.05;
export const STREAK_BONUS_MAX_DAYS = 10;
export const CRIT_CHANCE_CAP = 25;

export const STAT_BASE = 5;
export const COMPLETIONS_PER_STAT_POINT = 5;
export const STAT_CAP = 99;
export const MAX_HP_BASE = 39;

export const XP_TO_NEXT_BASE = 150;
export const XP_TO_NEXT_PER_LEVEL = 50;
export const LEVEL_UP_GOLD = 25;

export const FAINT_GOLD_LOSS_FRACTION = 0.25;
export const FAINT_HP_RESTORE_FRACTION = 0.5;

/** Which stat a category trains. `none` trains nothing. */
export const CATEGORY_STAT: Readonly<Record<Category, StatName | null>> = {
  body: 'STR',
  mind: 'INT',
  health: 'CON',
  none: null,
};

/** Base values for a habit: bad habits ignore difficulty. */
export function baseValues(type: HabitType, difficulty: Difficulty): BaseValues {
  return type === 'bad' ? BAD_HABIT_VALUES : DIFFICULTY_VALUES[difficulty];
}
