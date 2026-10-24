import { describe, expect, it } from 'vitest';

import { applyHpChange, applyXp, newHero, xpToNext, type Hero } from './character.ts';
import { fromTotalXp, heroDelta, replayHero, totalXp, type HeroDelta } from './events.ts';

describe('totalXp and fromTotalXp', () => {
  it('count XP across levels and back', () => {
    expect(totalXp({ level: 1, xpInLevel: 0 })).toBe(0);
    expect(totalXp({ level: 3, xpInLevel: 10 })).toBe(xpToNext(1) + xpToNext(2) + 10);
    for (const total of [0, 1, 199, 200, 201, 1234, 99_999]) {
      expect(totalXp(fromTotalXp(total))).toBe(total);
    }
    expect(fromTotalXp(xpToNext(1))).toEqual({ level: 2, xpInLevel: 0 });
  });
});

describe('replayHero', () => {
  it('starts from the new hero', () => {
    expect(replayHero([])).toEqual(newHero());
  });

  it('reproduces a hero through level-ups, an undo that clamps, and a faint', () => {
    const MAX_HP = 50;
    const deltas: HeroDelta[] = [];
    let hero: Hero = newHero();
    const step = (next: Hero) => {
      deltas.push(heroDelta(hero, next));
      hero = next;
    };
    // Enough XP for two levels in one go, plus level-up gold and full HP.
    step(applyXp(hero, xpToNext(1) + xpToNext(2) + 5, MAX_HP).hero);
    // Gold from a reward, then an undo larger than this level's progress (clamps at 0).
    step({ ...hero, gold: hero.gold + 9 });
    step(applyXp(hero, -40, MAX_HP).hero);
    // Damage, then a faint (gold and XP lost, half HP back).
    step(applyHpChange(hero, -30, MAX_HP).hero);
    step(applyHpChange(hero, -999, MAX_HP).hero);

    expect(hero.level).toBe(3);
    expect(replayHero(deltas)).toEqual(hero);
  });
});
