import { describe, expect, it } from 'vitest';

import {
  applyHpChange,
  applyXp,
  categoryStat,
  luckStat,
  maxHp,
  newHero,
  xpToNext,
  type Hero,
} from './character.ts';

const hero = (overrides: Partial<Hero> = {}): Hero => ({
  level: 7,
  xpInLevel: 340,
  hp: 42,
  gold: 128,
  ...overrides,
});

describe('xpToNext', () => {
  it('is 150 + 50 * level', () => {
    expect(xpToNext(1)).toBe(200);
    expect(xpToNext(7)).toBe(500);
  });
});

describe('stats', () => {
  it('starts every category stat at 5 and adds 1 per 5 completions', () => {
    expect(categoryStat(0)).toBe(5);
    expect(categoryStat(4)).toBe(5);
    expect(categoryStat(11)).toBe(7);
  });

  it('adds gear bonuses and caps at 99', () => {
    expect(categoryStat(12, 3)).toBe(10);
    expect(categoryStat(1000, 10)).toBe(99);
  });

  it('derives LUCK from half the longest streak, plus gear, capped at 99', () => {
    expect(luckStat(0)).toBe(0);
    expect(luckStat(9)).toBe(4);
    expect(luckStat(16, 3)).toBe(11);
    expect(luckStat(500, 5)).toBe(99);
  });

  it('gives 39 + CON max HP', () => {
    expect(maxHp(5)).toBe(44);
    expect(maxHp(11)).toBe(50);
  });
});

describe('newHero', () => {
  it('starts at level 1 with 44 HP and no gold', () => {
    expect(newHero()).toEqual({ level: 1, xpInLevel: 0, hp: 44, gold: 0 });
  });
});

describe('applyXp', () => {
  it('adds XP within a level without touching HP or gold', () => {
    expect(applyXp(hero(), 100, 50)).toEqual({ hero: hero({ xpInLevel: 440 }), levelsGained: 0 });
  });

  it('levels up exactly at the threshold, carrying over nothing', () => {
    const result = applyXp(hero(), 160, 50);
    expect(result.hero).toEqual({ level: 8, xpInLevel: 0, hp: 50, gold: 153 });
    expect(result.levelsGained).toBe(1);
  });

  it('carries extra XP into the next level, refills HP and grants 25 gold', () => {
    const result = applyXp(hero(), 200, 50);
    expect(result.hero).toEqual({ level: 8, xpInLevel: 40, hp: 50, gold: 153 });
  });

  it('can gain several levels at once', () => {
    const result = applyXp(newHero(), 1000, 44);
    // 1000 - 200 (lv1) - 250 (lv2) - 300 (lv3) = 250 into level 4, which needs 350.
    expect(result).toEqual({
      hero: { level: 4, xpInLevel: 250, hp: 44, gold: 75 },
      levelsGained: 3,
    });
  });

  it('removes XP on undo but never below 0 or down a level', () => {
    expect(applyXp(hero({ xpInLevel: 30 }), -50, 50).hero).toEqual(hero({ xpInLevel: 0 }));
    expect(applyXp(hero(), -40, 50).hero.xpInLevel).toBe(300);
  });
});

describe('applyHpChange', () => {
  it('applies damage that leaves the hero standing', () => {
    expect(applyHpChange(hero(), -8, 50)).toEqual({ hero: hero({ hp: 34 }), faint: null });
  });

  it('never heals above max HP', () => {
    expect(applyHpChange(hero(), 100, 50).hero.hp).toBe(50);
  });

  it('faints at 0 HP: loses 25% of gold and the level XP, keeps the level, returns at half HP', () => {
    const result = applyHpChange(hero({ hp: 6 }), -8, 50);
    expect(result.hero).toEqual({ level: 7, xpInLevel: 0, hp: 25, gold: 96 });
    expect(result.faint).toEqual({ goldLost: 32, xpLost: 340 });
  });

  it('rounds the gold lost and the restored HP down', () => {
    const result = applyHpChange(hero({ hp: 4, gold: 3 }), -4, 45);
    expect(result.hero).toMatchObject({ hp: 22, gold: 3 });
    expect(result.faint?.goldLost).toBe(0);
  });
});
