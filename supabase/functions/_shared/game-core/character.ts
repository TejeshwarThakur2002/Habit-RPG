// Generated from packages/game-core/src/character.ts by scripts/copy-functions-shared.mjs.
// Do not edit; change the source and run `pnpm functions:shared`.

import {
  COMPLETIONS_PER_STAT_POINT,
  FAINT_GOLD_LOSS_FRACTION,
  FAINT_HP_RESTORE_FRACTION,
  LEVEL_UP_GOLD,
  MAX_HP_BASE,
  STAT_BASE,
  STAT_CAP,
  XP_TO_NEXT_BASE,
  XP_TO_NEXT_PER_LEVEL,
} from './constants.ts';
import { clamp } from './math.ts';

/** The progress part of a hero; stats are derived, never stored (SCOPE.md section 3). */
export interface Hero {
  level: number;
  xpInLevel: number;
  hp: number;
  gold: number;
}

/** xp_to_next(level) = 150 + 50 * level. Level 7 needs 500. */
export function xpToNext(level: number): number {
  return XP_TO_NEXT_BASE + XP_TO_NEXT_PER_LEVEL * level;
}

/** STR, INT or CON: 5 + floor(completions_in_category / 5) + gear_bonus, capped at 99. */
export function categoryStat(completionsInCategory: number, gearBonus = 0): number {
  return Math.min(
    STAT_CAP,
    STAT_BASE + Math.floor(completionsInCategory / COMPLETIONS_PER_STAT_POINT) + gearBonus,
  );
}

/** LUCK = floor(longest_streak_days / 2) + gear_bonus, capped at 99. */
export function luckStat(longestStreakDays: number, gearBonus = 0): number {
  return Math.min(STAT_CAP, Math.floor(longestStreakDays / 2) + gearBonus);
}

/** max_hp = 39 + CON, so a new hero (CON 5) has 44 and CON 11 gives 50. */
export function maxHp(con: number): number {
  return MAX_HP_BASE + con;
}

/** A brand-new hero after onboarding (SCOPE.md F1): level 1, full HP, no gold. */
export function newHero(): Hero {
  return { level: 1, xpInLevel: 0, hp: maxHp(STAT_BASE), gold: 0 };
}

export interface XpResult {
  hero: Hero;
  levelsGained: number;
}

/**
 * Adds (or, for an undo, removes) XP. Extra XP carries into the next level; each level-up
 * refills HP and grants 25 gold. Removing XP never lowers the level: it clamps at 0 in the
 * current level (SCOPE.md section 8.3, "Authoritative hero").
 */
export function applyXp(hero: Hero, delta: number, heroMaxHp: number): XpResult {
  if (delta < 0) {
    return { hero: { ...hero, xpInLevel: Math.max(0, hero.xpInLevel + delta) }, levelsGained: 0 };
  }

  let { level, xpInLevel } = hero;
  let levelsGained = 0;
  xpInLevel += delta;
  while (xpInLevel >= xpToNext(level)) {
    xpInLevel -= xpToNext(level);
    level += 1;
    levelsGained += 1;
  }

  if (levelsGained === 0) {
    return { hero: { ...hero, xpInLevel }, levelsGained };
  }
  return {
    hero: { level, xpInLevel, hp: heroMaxHp, gold: hero.gold + LEVEL_UP_GOLD * levelsGained },
    levelsGained,
  };
}

export interface Faint {
  goldLost: number;
  xpLost: number;
}

export interface HpResult {
  hero: Hero;
  /** Set when this change brought HP to 0. */
  faint: Faint | null;
}

/**
 * Changes HP (negative = damage), keeping it within 0..max. Reaching 0 faints the hero:
 * they lose 25% of their gold (rounded down) and all XP in the current level, keep their
 * level, and come back with 50% of max HP (rounded down; DECISIONS.md D10).
 */
export function applyHpChange(hero: Hero, delta: number, heroMaxHp: number): HpResult {
  const hp = clamp(hero.hp + delta, 0, heroMaxHp);
  if (hp > 0) {
    return { hero: { ...hero, hp }, faint: null };
  }

  const goldLost = Math.floor(hero.gold * FAINT_GOLD_LOSS_FRACTION);
  const faint: Faint = { goldLost, xpLost: hero.xpInLevel };
  return {
    hero: {
      level: hero.level,
      xpInLevel: 0,
      hp: Math.floor(heroMaxHp * FAINT_HP_RESTORE_FRACTION),
      gold: hero.gold - goldLost,
    },
    faint,
  };
}
