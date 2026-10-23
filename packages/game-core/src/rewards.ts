import {
  CRIT_CHANCE_CAP,
  STREAK_BONUS_MAX_DAYS,
  STREAK_BONUS_PER_DAY,
  type BaseValues,
} from './constants.ts';
import { divRound, hash32 } from './math.ts';

export interface RewardInput {
  base: BaseValues;
  /** The completion's UUID; seeds the crit roll. */
  completionId: string;
  /** Global streak in days before this completion. */
  streakDays: number;
  str: number;
  int: number;
  luck: number;
  /** Extra XP percent from gear (e.g. Wizard Hat on Mind habits), applied after the INT bonus. */
  bonusXpPercent?: number;
  /** A completion synced after its day closed gets no streak bonus (SCOPE.md section 3, day close). */
  isLate?: boolean;
}

export interface Reward {
  xp: number;
  gold: number;
  bossDamage: number;
  crit: boolean;
}

// The streak multiplier 1 + 0.05 * min(days, 10) as an integer percent: 100..150.
const STREAK_PERCENT_PER_DAY = Math.round(STREAK_BONUS_PER_DAY * 100);

export function streakPercent(streakDays: number): number {
  return 100 + STREAK_PERCENT_PER_DAY * Math.min(Math.max(streakDays, 0), STREAK_BONUS_MAX_DAYS);
}

/** crit = (hash32(completion_id) % 100) < min(LUCK, 25). */
export function isCrit(completionId: string, luck: number): boolean {
  return hash32(completionId) % 100 < Math.min(luck, CRIT_CHANCE_CAP);
}

/**
 * Rewards for one completion (SCOPE.md section 3, "Rewards for one completion"):
 * xp = round(base_xp * streak_mult * (1 + INT / 200)), gold doubled on crit,
 * boss_damage = round(base_xp * (1 + STR / 100)).
 */
export function computeReward(input: RewardInput): Reward {
  const { base, completionId, str, int, luck } = input;
  const streak = input.isLate ? 100 : streakPercent(input.streakDays);
  const bonus = 100 + (input.bonusXpPercent ?? 0);

  // base * (streak / 100) * ((200 + INT) / 200) * (bonus / 100), in one exact integer step.
  const xp = divRound(base.xp * streak * (200 + int) * bonus, 100 * 200 * 100);
  const crit = isCrit(completionId, luck);

  return {
    xp,
    gold: crit ? base.gold * 2 : base.gold,
    bossDamage: divRound(base.xp * (100 + str), 100),
    crit,
  };
}
