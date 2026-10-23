import { describe, expect, it } from 'vitest';

import {
  BOSS_ROSTER,
  daysLeftInWeek,
  generatePartyCode,
  nextBoss,
  normalisePartyCode,
  undoBossDamage,
  weekStart,
} from './boss.ts';
import {
  GEAR,
  canBuy,
  equip,
  gearBonuses,
  gearItem,
  heroStats,
  unequip,
  xpBonusFor,
  type GearId,
} from './gear.ts';

describe('gear catalog', () => {
  it('has the six items from the scope with one item per slot', () => {
    expect(GEAR.map((g) => [g.name, g.price, g.unlockLevel])).toEqual([
      ['Iron Sword', 60, 1],
      ['Oak Shield', 40, 1],
      ['Wizard Hat', 75, 1],
      ['Leather Boots', 50, 1],
      ['Lucky Clover Charm', 90, 3],
      ['Dragon Cape', 200, 10],
    ]);
    expect(new Set(GEAR.map((g) => g.slot)).size).toBe(GEAR.length);
  });

  it('rejects an unknown id', () => {
    expect(() => gearItem('banana' as GearId)).toThrow('Unknown gear id');
  });
});

describe('gearBonuses and heroStats', () => {
  const equipped: GearId[] = ['iron-sword', 'oak-shield', 'wizard-hat', 'leather-boots'];

  it('adds up stats, shield blocks and XP bonuses', () => {
    const bonuses = gearBonuses(equipped);
    expect(bonuses.stats).toEqual({ STR: 4, INT: 3, CON: 3, LUCK: 0 });
    expect(bonuses.missesToBlock).toBe(1);
    expect(xpBonusFor(bonuses, 'mind')).toBe(10);
    expect(xpBonusFor(bonuses, 'body')).toBe(0);
  });

  it('derives the hero sheet: CON 11 gives 50 max HP', () => {
    const stats = heroStats({
      completionsByCategory: { body: 25, mind: 40, health: 15 },
      longestStreakDays: 16,
      equipped,
    });
    expect(stats).toEqual({ STR: 14, INT: 16, CON: 11, LUCK: 8, maxHp: 50 });
  });

  it('treats missing categories as no completions', () => {
    expect(heroStats({ completionsByCategory: {}, longestStreakDays: 0, equipped: [] })).toEqual({
      STR: 5,
      INT: 5,
      CON: 5,
      LUCK: 0,
      maxHp: 44,
    });
  });
});

describe('canBuy', () => {
  it('allows a buy with enough gold and level', () => {
    expect(canBuy('oak-shield', { level: 1, gold: 40 }, [])).toEqual({ ok: true });
  });

  it('explains why a buy is not allowed', () => {
    expect(canBuy('oak-shield', { level: 1, gold: 99 }, ['oak-shield'])).toEqual({
      ok: false,
      reason: 'owned',
    });
    expect(canBuy('dragon-cape', { level: 7, gold: 500 }, [])).toEqual({
      ok: false,
      reason: 'locked',
      unlockLevel: 10,
    });
    expect(canBuy('wizard-hat', { level: 7, gold: 50 }, [])).toEqual({
      ok: false,
      reason: 'insufficient_gold',
      goldNeeded: 25,
    });
  });
});

describe('equip and unequip', () => {
  it('replaces the item already in the same slot', () => {
    expect(equip(['iron-sword', 'oak-shield'], 'wizard-hat')).toEqual([
      'iron-sword',
      'oak-shield',
      'wizard-hat',
    ]);
    expect(equip(['iron-sword'], 'iron-sword')).toEqual(['iron-sword']);
  });

  it('removes an item', () => {
    expect(unequip(['iron-sword', 'oak-shield'], 'iron-sword')).toEqual(['oak-shield']);
  });
});

describe('boss rotation and week', () => {
  it('starts with the Slime and wraps after Monday', () => {
    expect(nextBoss(null)).toBe('procrastination-slime');
    expect(nextBoss('procrastination-slime')).toBe('snooze-goblin');
    expect(nextBoss('monday')).toBe(BOSS_ROSTER[0]);
  });

  it('finds the Monday that starts the week in the party zone', () => {
    // Tuesday 20 October 2026 in Los Angeles; Wednesday the 21st in Auckland.
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(weekStart(now, 'America/Los_Angeles')).toBe('2026-10-19');
    // Sunday 25 October late evening in Los Angeles is still the same week.
    expect(weekStart(Date.parse('2026-10-26T06:30:00Z'), 'America/Los_Angeles')).toBe('2026-10-19');
    // 00:30 on Monday 26 October in Auckland starts a new week.
    expect(weekStart(Date.parse('2026-10-25T11:30:00Z'), 'Pacific/Auckland')).toBe('2026-10-26');
  });

  it('counts days left including today', () => {
    expect(daysLeftInWeek('2026-10-19')).toBe(7);
    expect(daysLeftInWeek('2026-10-22')).toBe(4);
    expect(daysLeftInWeek('2026-10-25')).toBe(1);
  });
});

describe('undoBossDamage', () => {
  it('gives damage back up to max HP', () => {
    expect(undoBossDamage(1206, 2000, 34)).toBe(1240);
    expect(undoBossDamage(1990, 2000, 34)).toBe(2000);
  });

  it('keeps a defeated boss defeated', () => {
    expect(undoBossDamage(0, 2000, 34)).toBe(0);
  });
});

describe('party codes', () => {
  it('builds a 6-character code from the allowed alphabet', () => {
    let i = 0;
    const code = generatePartyCode((n) => i++ % n);
    expect(code).toBe('ABCDEF');
    const last = generatePartyCode((n) => n - 1);
    expect(last).toBe('999999');
  });

  it('normalises case and rejects bad codes', () => {
    expect(normalisePartyCode(' k7m2qx ')).toBe('K7M2QX');
    expect(normalisePartyCode('K7M2Q')).toBeNull();
    expect(normalisePartyCode('K7M2QO')).toBeNull(); // O is not allowed
    expect(normalisePartyCode('K1M2QX')).toBeNull(); // 1 is not allowed
  });
});
