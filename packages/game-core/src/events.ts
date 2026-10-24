// The hero's event log (SCOPE.md section 8.3, "Authoritative hero"). Every change the server
// makes to a hero is stored as how much it changed total XP, gold and HP. Total XP counts
// across levels, so replaying the log is just adding the changes up: level-ups, an undo that
// clamps at the start of a level, and fainting all replay exactly (DECISIONS.md D38).

import { newHero, xpToNext, type Hero } from './character.ts';

/** How one event changed the hero. */
export interface HeroDelta {
  xp: number;
  gold: number;
  hp: number;
}

/** All the XP a hero has earned: every level below theirs, plus progress in this one. */
export function totalXp(hero: Pick<Hero, 'level' | 'xpInLevel'>): number {
  let total = hero.xpInLevel;
  for (let level = 1; level < hero.level; level += 1) total += xpToNext(level);
  return total;
}

/** The level and progress that a total XP amounts to. */
export function fromTotalXp(total: number): Pick<Hero, 'level' | 'xpInLevel'> {
  let level = 1;
  let rest = total;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  return { level, xpInLevel: rest };
}

export function heroDelta(before: Hero, after: Hero): HeroDelta {
  return {
    xp: totalXp(after) - totalXp(before),
    gold: after.gold - before.gold,
    hp: after.hp - before.hp,
  };
}

/** The hero a log of changes adds up to, starting from game-core's new hero. */
export function replayHero(deltas: readonly HeroDelta[]): Hero {
  const start = newHero();
  let xp = totalXp(start);
  let { gold, hp } = start;
  for (const delta of deltas) {
    xp += delta.xp;
    gold += delta.gold;
    hp += delta.hp;
  }
  return { ...fromTotalXp(xp), gold, hp };
}
