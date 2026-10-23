// Runs the golden vectors (packages/game-core/golden) against the copy of game-core that Edge
// Functions import, so the server computes exactly what the app does (SCOPE.md section 13.1).

import { assertEquals } from '@std/assert';

import vectors from '../../../packages/game-core/golden/vectors.json' with { type: 'json' };
import {
  applyBossDamage,
  applyHpChange,
  applyXp,
  baseValues,
  bossMaxHp,
  computeReward,
  type Difficulty,
  type HabitType,
  type Hero,
} from '../_shared/game-core/index.ts';

for (const { name, input, expected } of vectors.rewards) {
  Deno.test(`rewards: ${name}`, () => {
    const { type, difficulty, ...rest } = input;
    const base = baseValues(type as HabitType, difficulty as Difficulty);
    assertEquals(computeReward({ base, ...rest }), expected);
  });
}

for (const { name, input, expected } of vectors.xp) {
  Deno.test(`xp: ${name}`, () => {
    assertEquals(applyXp(input.hero as Hero, input.delta, input.maxHp), expected);
  });
}

for (const { name, input, expected } of vectors.hp) {
  Deno.test(`hp: ${name}`, () => {
    assertEquals(applyHpChange(input.hero as Hero, input.delta, input.maxHp), expected);
  });
}

for (const { name, input, expected } of vectors.boss) {
  Deno.test(`boss: ${name}`, () => {
    const hit = applyBossDamage(input.currentHp, input.damage);
    assertEquals({ maxHp: bossMaxHp(input.memberCount), ...hit }, expected);
  });
}
