// Everything the Quests tab shows, read in one synchronous pass (SCOPE.md section 5.4).

import {
  baseValues,
  computeReward,
  gearBonuses,
  heroStats,
  isScheduledOn,
  xpBonusFor,
  xpToNext,
  type Category,
  type HeroStats,
} from '@habit-rpg/game-core';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { bossWeeks, completions, partyMembers } from '../schema';
import type { AppDb } from '../types';
import { getCharacter, getProfile, listActiveHabits, listEquippedGear, type Habit } from './hero';

export interface QuestItem {
  habit: Habit;
  /** The XP completing it now would give: streak, INT and gear included (section 5.4). */
  rewardXp: number;
  doneToday: boolean;
}

export interface BossSummary {
  bossKey: string;
  hpPercent: number;
}

export interface QuestBoard {
  heroName: string;
  heroClass: NonNullable<ReturnType<typeof getProfile>>['heroClass'];
  level: number;
  hp: number;
  maxHp: number;
  xpInLevel: number;
  xpToNext: number;
  gold: number;
  streak: number;
  equipped: ReturnType<typeof listEquippedGear>;
  today: QuestItem[];
  laterThisWeek: Habit[];
  boss: BossSummary | null;
}

/** Active completions per category, which drive STR, INT and CON (section 3). */
export function completionsByCategory(db: AppDb, userId: string) {
  const rows = db
    .select({ category: completions.category, count: sql<number>`count(*)` })
    .from(completions)
    .where(and(eq(completions.userId, userId), isNull(completions.undoneAt)))
    .groupBy(completions.category)
    .all();
  return Object.fromEntries(rows.map((r) => [r.category, r.count])) as Partial<
    Record<Category, number>
  >;
}

export function heroStatsFor(db: AppDb, userId: string): HeroStats {
  const character = getCharacter(db, userId);
  return heroStats({
    completionsByCategory: completionsByCategory(db, userId),
    longestStreakDays: character?.longestStreak ?? 0,
    equipped: listEquippedGear(db, userId),
  });
}

/** Habit ids with an active completion on `date`. */
export function completedOn(db: AppDb, userId: string, date: string): Set<string> {
  const rows = db
    .select({ habitId: completions.habitId })
    .from(completions)
    .where(
      and(
        eq(completions.userId, userId),
        eq(completions.localDate, date),
        isNull(completions.undoneAt),
      ),
    )
    .all();
  return new Set(rows.map((r) => r.habitId));
}

function currentBoss(db: AppDb, userId: string): BossSummary | null {
  const row = db
    .select({ bossKey: bossWeeks.bossKey, maxHp: bossWeeks.maxHp, currentHp: bossWeeks.currentHp })
    .from(bossWeeks)
    .innerJoin(partyMembers, eq(partyMembers.partyId, bossWeeks.partyId))
    .where(and(eq(partyMembers.userId, userId), isNull(partyMembers.leftAt)))
    .orderBy(desc(bossWeeks.weekStart))
    .get();
  if (!row || row.maxHp === 0) return null;
  return { bossKey: row.bossKey, hpPercent: Math.round((row.currentHp / row.maxHp) * 100) };
}

export function getQuestBoard(db: AppDb, userId: string, today: string): QuestBoard | null {
  const profile = getProfile(db, userId);
  const character = getCharacter(db, userId);
  if (!profile || !character) return null;

  const stats = heroStatsFor(db, userId);
  const equipped = listEquippedGear(db, userId);
  const gear = gearBonuses(equipped);
  const done = completedOn(db, userId, today);
  const habits = listActiveHabits(db, userId);

  const today_ = habits
    .filter((h) => isScheduledOn(h, today))
    .map((habit) => ({
      habit,
      doneToday: done.has(habit.id),
      rewardXp: computeReward({
        base: baseValues(habit.type, habit.difficulty),
        // Crit only changes gold, so any id gives the right XP for the preview.
        completionId: habit.id,
        streakDays: character.currentStreak,
        str: stats.STR,
        int: stats.INT,
        luck: stats.LUCK,
        bonusXpPercent: xpBonusFor(gear, habit.category),
      }).xp,
    }));

  return {
    heroName: profile.heroName,
    heroClass: profile.heroClass,
    level: character.level,
    hp: character.hp,
    maxHp: stats.maxHp,
    xpInLevel: character.xpInLevel,
    xpToNext: xpToNext(character.level),
    gold: character.gold,
    streak: character.currentStreak,
    equipped,
    today: today_,
    laterThisWeek: habits.filter((h) => !isScheduledOn(h, today)),
    boss: currentBoss(db, userId),
  };
}
