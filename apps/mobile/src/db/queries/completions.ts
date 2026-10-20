// Completing and undoing a habit (SCOPE.md F3). Each runs in one synchronous SQLite
// transaction, so the screen repaints within the 100 ms budget with no network involved.

import {
  applyXp,
  baseValues,
  computeReward,
  gearBonuses,
  localDate,
  xpBonusFor,
  type Reward,
} from '@habit-rpg/game-core';
import { and, eq, isNull } from 'drizzle-orm';

import { characters, completions, habits } from '../schema';
import type { AppDb } from '../types';
import { getCharacter, getProfile, listEquippedGear } from './hero';
import { heroStatsFor } from './quest-board';

export interface CompleteInput {
  userId: string;
  habitId: string;
  now: number;
  newId: () => string;
}

export interface CompleteResult {
  completionId: string;
  reward: Reward;
  levelsGained: number;
}

/**
 * Records a completion for today and applies its rewards to the local hero estimate.
 * Returns null if the habit is already done today (a double tap) or does not exist.
 */
export function completeHabit(db: AppDb, input: CompleteInput): CompleteResult | null {
  return db.transaction((tx) => {
    const profile = getProfile(tx, input.userId);
    const character = getCharacter(tx, input.userId);
    const habit = tx.select().from(habits).where(eq(habits.id, input.habitId)).get();
    if (!profile || !character || !habit) return null;

    const today = localDate(input.now, profile.timezone);
    const existing = tx
      .select({ id: completions.id })
      .from(completions)
      .where(
        and(
          eq(completions.habitId, habit.id),
          eq(completions.localDate, today),
          isNull(completions.undoneAt),
        ),
      )
      .get();
    if (existing) return null;

    const stats = heroStatsFor(tx, input.userId);
    const completionId = input.newId();
    const reward = computeReward({
      base: baseValues(habit.type, habit.difficulty),
      completionId,
      streakDays: character.currentStreak,
      str: stats.STR,
      int: stats.INT,
      luck: stats.LUCK,
      bonusXpPercent: xpBonusFor(gearBonuses(listEquippedGear(tx, input.userId)), habit.category),
    });

    tx.insert(completions)
      .values({
        id: completionId,
        userId: input.userId,
        habitId: habit.id,
        localDate: today,
        completedAt: new Date(input.now).toISOString(),
        category: habit.category,
        xpAwarded: reward.xp,
        goldAwarded: reward.gold,
        bossDamage: reward.bossDamage,
      })
      .run();

    // Max HP after this completion: a new CON point can raise it.
    const { hero, levelsGained } = applyXp(
      character,
      reward.xp,
      heroStatsFor(tx, input.userId).maxHp,
    );
    tx.update(characters)
      .set({
        level: hero.level,
        xpInLevel: hero.xpInLevel,
        hp: hero.hp,
        gold: hero.gold + reward.gold,
      })
      .where(eq(characters.userId, input.userId))
      .run();

    return { completionId, reward, levelsGained };
  });
}

/**
 * Undoes today's completion of a habit: marks it undone (never deleted) and takes back its
 * XP and gold. XP clamps at 0 in the current level and the level never drops (section 8.3).
 */
export function undoCompletion(db: AppDb, userId: string, habitId: string, now: number): boolean {
  return db.transaction((tx) => {
    const profile = getProfile(tx, userId);
    const character = getCharacter(tx, userId);
    if (!profile || !character) return false;

    const today = localDate(now, profile.timezone);
    const completion = tx
      .select()
      .from(completions)
      .where(
        and(
          eq(completions.habitId, habitId),
          eq(completions.localDate, today),
          isNull(completions.undoneAt),
        ),
      )
      .get();
    if (!completion) return false;

    tx.update(completions)
      .set({ undoneAt: new Date(now).toISOString() })
      .where(eq(completions.id, completion.id))
      .run();

    const { hero } = applyXp(character, -completion.xpAwarded, character.hp);
    tx.update(characters)
      .set({
        xpInLevel: hero.xpInLevel,
        gold: Math.max(0, character.gold - completion.goldAwarded),
      })
      .where(eq(characters.userId, userId))
      .run();
    return true;
  });
}
