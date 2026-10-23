import { describe, expect, it } from 'vitest';

import { BAD_HABIT_VALUES, DIFFICULTY_VALUES, baseValues } from './constants.ts';
import { divRound, hash32 } from './math.ts';
import { computeReward, isCrit, streakPercent } from './rewards.ts';

// Crit rolls (hash32(id) % 100) for fixed ids, so tests don't depend on random UUIDs.
const ROLL_8 = '9b1d2e3f-4a5b-4c6d-8e7f-1a2b3c4d5e6f';
const ROLL_46 = '3f2b8c1e-7a4d-4e2b-9c1a-0d5e6f7a8b9c';

const medium = DIFFICULTY_VALUES.medium;
const neutral = { completionId: ROLL_46, streakDays: 0, str: 0, int: 0, luck: 0 };

describe('hash32 (FNV-1a)', () => {
  it('matches the published FNV-1a 32-bit reference values', () => {
    expect(hash32('')).toBe(0x811c9dc5);
    expect(hash32('a')).toBe(0xe40c292c);
    expect(hash32('foobar')).toBe(0xbf9cf968);
  });

  it('gives the rolls the tests rely on', () => {
    expect(hash32(ROLL_8) % 100).toBe(8);
    expect(hash32(ROLL_46) % 100).toBe(46);
  });
});

describe('divRound', () => {
  it('rounds halves up and everything else to the nearest integer', () => {
    expect(divRound(41, 2)).toBe(21);
    expect(divRound(40, 3)).toBe(13);
    expect(divRound(0, 7)).toBe(0);
  });
});

describe('baseValues', () => {
  it('uses the difficulty table for normal habits', () => {
    expect(baseValues('daily', 'hard')).toEqual({ xp: 30, gold: 9, hpLoss: 8 });
    expect(baseValues('weekdays', 'easy')).toEqual({ xp: 10, gold: 3, hpLoss: 4 });
  });

  it('gives bad habits fixed values whatever their difficulty', () => {
    expect(baseValues('bad', 'easy')).toBe(BAD_HABIT_VALUES);
    expect(baseValues('bad', 'hard')).toEqual({ xp: 5, gold: 2, hpLoss: 8 });
  });
});

describe('streakPercent', () => {
  it('adds 5% per streak day, capped at 10 days', () => {
    expect(streakPercent(0)).toBe(100);
    expect(streakPercent(3)).toBe(115);
    expect(streakPercent(10)).toBe(150);
    expect(streakPercent(400)).toBe(150);
  });

  it('treats a negative streak as no streak', () => {
    expect(streakPercent(-2)).toBe(100);
  });
});

describe('isCrit', () => {
  it('crits when the roll is below LUCK', () => {
    expect(isCrit(ROLL_8, 9)).toBe(true);
    expect(isCrit(ROLL_8, 8)).toBe(false);
  });

  it('caps the crit chance at 25 however high LUCK is', () => {
    expect(isCrit(ROLL_46, 99)).toBe(false);
  });

  it('is the same every time for the same id', () => {
    expect(isCrit(ROLL_8, 20)).toBe(isCrit(ROLL_8, 20));
  });
});

describe('computeReward', () => {
  it('gives base values with no bonuses', () => {
    expect(computeReward({ ...neutral, base: medium })).toEqual({
      xp: 20,
      gold: 6,
      bossDamage: 20,
      crit: false,
    });
  });

  it('applies the INT bonus: a new hero (INT 5) gets 20.5 -> 21 XP on a medium habit', () => {
    expect(computeReward({ ...neutral, base: medium, int: 5 }).xp).toBe(21);
  });

  it('combines streak and INT: 20 * 1.5 * 1.095 = 32.85 -> 33', () => {
    expect(computeReward({ ...neutral, base: medium, streakDays: 12, int: 19 }).xp).toBe(33);
  });

  it('rounds a partial streak bonus: 10 * 1.15 * 1.025 = 11.79 -> 12', () => {
    const easy = DIFFICULTY_VALUES.easy;
    expect(computeReward({ ...neutral, base: easy, streakDays: 3, int: 5 }).xp).toBe(12);
  });

  it('drops the streak bonus for a late completion', () => {
    expect(computeReward({ ...neutral, base: medium, streakDays: 10, isLate: true }).xp).toBe(20);
  });

  it('applies a gear XP bonus after the other multipliers', () => {
    expect(computeReward({ ...neutral, base: medium, bonusXpPercent: 10 }).xp).toBe(22);
  });

  it('doubles gold on a crit and leaves XP alone', () => {
    const reward = computeReward({ ...neutral, base: medium, completionId: ROLL_8, luck: 25 });
    expect(reward).toMatchObject({ crit: true, gold: 12, xp: 20 });
  });

  it('scales boss damage with STR: 30 * 1.14 = 34.2 -> 34, and 10 * 1.05 = 10.5 -> 11', () => {
    expect(computeReward({ ...neutral, base: DIFFICULTY_VALUES.hard, str: 14 }).bossDamage).toBe(
      34,
    );
    expect(computeReward({ ...neutral, base: DIFFICULTY_VALUES.easy, str: 5 }).bossDamage).toBe(11);
  });

  it('does not let the streak bonus touch boss damage', () => {
    expect(computeReward({ ...neutral, base: medium, streakDays: 10 }).bossDamage).toBe(20);
  });
});
