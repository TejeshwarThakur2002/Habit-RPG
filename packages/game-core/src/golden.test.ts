import { describe, expect, it } from 'vitest';

import vectors from '../golden/vectors.json';
import { bossMaxHp, applyBossDamage } from './boss.ts';
import { applyHpChange, applyXp, type Hero } from './character.ts';
import { baseValues, type Difficulty, type HabitType } from './constants.ts';
import { computeReward } from './rewards.ts';

// The same file is checked by the Deno Edge Function tests in P3 (SCOPE.md section 13.1).
describe('golden vectors', () => {
  describe('rewards', () => {
    for (const { name, input, expected } of vectors.rewards) {
      it(name, () => {
        const { type, difficulty, ...rest } = input;
        const base = baseValues(type as HabitType, difficulty as Difficulty);
        expect(computeReward({ base, ...rest })).toEqual(expected);
      });
    }
  });

  describe('xp', () => {
    for (const { name, input, expected } of vectors.xp) {
      it(name, () => {
        expect(applyXp(input.hero as Hero, input.delta, input.maxHp)).toEqual(expected);
      });
    }
  });

  describe('hp', () => {
    for (const { name, input, expected } of vectors.hp) {
      it(name, () => {
        expect(applyHpChange(input.hero as Hero, input.delta, input.maxHp)).toEqual(expected);
      });
    }
  });

  describe('boss', () => {
    for (const { name, input, expected } of vectors.boss) {
      it(name, () => {
        const hit = applyBossDamage(input.currentHp, input.damage);
        expect({ maxHp: bossMaxHp(input.memberCount), ...hit }).toEqual(expected);
      });
    }
  });
});
