// Gear (SCOPE.md section 3, "Gear"): cosmetic items with small bonuses, one per slot,
// bought once with gold earned from habits and then equipped or unequipped for free.

import { categoryStat, luckStat, maxHp } from './character';
import type { Category, StatName } from './constants';

export type GearSlot = 'weapon' | 'off-hand' | 'head' | 'feet' | 'trinket' | 'back';
export type GearId =
  | 'iron-sword'
  | 'oak-shield'
  | 'wizard-hat'
  | 'leather-boots'
  | 'lucky-clover-charm'
  | 'dragon-cape';

export interface GearItem {
  id: GearId;
  name: string;
  slot: GearSlot;
  price: number;
  unlockLevel: number;
  stats: Partial<Record<StatName, number>>;
  /** Missed habits the item absorbs per day. */
  blocksMisses?: number;
  /** Extra XP percent on habits of one category. */
  xpBonus?: { category: Category; percent: number };
}

export const GEAR: readonly GearItem[] = [
  {
    id: 'iron-sword',
    name: 'Iron Sword',
    slot: 'weapon',
    price: 60,
    unlockLevel: 1,
    stats: { STR: 3 },
  },
  {
    id: 'oak-shield',
    name: 'Oak Shield',
    slot: 'off-hand',
    price: 40,
    unlockLevel: 1,
    stats: { CON: 2 },
    blocksMisses: 1,
  },
  {
    id: 'wizard-hat',
    name: 'Wizard Hat',
    slot: 'head',
    price: 75,
    unlockLevel: 1,
    stats: { INT: 3 },
    xpBonus: { category: 'mind', percent: 10 },
  },
  {
    id: 'leather-boots',
    name: 'Leather Boots',
    slot: 'feet',
    price: 50,
    unlockLevel: 1,
    stats: { STR: 1, CON: 1 },
  },
  {
    id: 'lucky-clover-charm',
    name: 'Lucky Clover Charm',
    slot: 'trinket',
    price: 90,
    unlockLevel: 3,
    stats: { LUCK: 3 },
  },
  {
    id: 'dragon-cape',
    name: 'Dragon Cape',
    slot: 'back',
    price: 200,
    unlockLevel: 10,
    stats: { STR: 2, LUCK: 2 },
  },
];

const BY_ID = new Map(GEAR.map((item) => [item.id, item]));

export function gearItem(id: GearId): GearItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`Unknown gear id: ${id}`);
  return item;
}

export interface GearBonuses {
  stats: Record<StatName, number>;
  missesToBlock: number;
  xpBonuses: { category: Category; percent: number }[];
}

export function gearBonuses(equipped: readonly GearId[]): GearBonuses {
  const stats: Record<StatName, number> = { STR: 0, INT: 0, CON: 0, LUCK: 0 };
  let missesToBlock = 0;
  const xpBonuses: GearBonuses['xpBonuses'] = [];
  for (const item of equipped.map(gearItem)) {
    for (const [stat, value] of Object.entries(item.stats) as [StatName, number][]) {
      stats[stat] += value;
    }
    missesToBlock += item.blocksMisses ?? 0;
    if (item.xpBonus) xpBonuses.push(item.xpBonus);
  }
  return { stats, missesToBlock, xpBonuses };
}

/** Gear XP bonus for a habit of `category`, for computeReward's bonusXpPercent. */
export function xpBonusFor(bonuses: GearBonuses, category: Category): number {
  return bonuses.xpBonuses
    .filter((b) => b.category === category)
    .reduce((sum, b) => sum + b.percent, 0);
}

export interface StatInput {
  completionsByCategory: Partial<Record<Category, number>>;
  longestStreakDays: number;
  equipped: readonly GearId[];
}

export interface HeroStats extends Record<StatName, number> {
  maxHp: number;
}

/** The hero's derived stats (SCOPE.md section 3, "HP, stats and fainting"). */
export function heroStats(input: StatInput): HeroStats {
  const gear = gearBonuses(input.equipped).stats;
  const done = input.completionsByCategory;
  const CON = categoryStat(done.health ?? 0, gear.CON);
  return {
    STR: categoryStat(done.body ?? 0, gear.STR),
    INT: categoryStat(done.mind ?? 0, gear.INT),
    CON,
    LUCK: luckStat(input.longestStreakDays, gear.LUCK),
    maxHp: maxHp(CON),
  };
}

export type BuyCheck =
  | { ok: true }
  | { ok: false; reason: 'owned' }
  | { ok: false; reason: 'locked'; unlockLevel: number }
  | { ok: false; reason: 'insufficient_gold'; goldNeeded: number };

/** Whether the hero can buy an item, with what the shop shows when they can't (SCOPE.md F5). */
export function canBuy(
  id: GearId,
  hero: { level: number; gold: number },
  owned: readonly GearId[],
): BuyCheck {
  const item = gearItem(id);
  if (owned.includes(id)) return { ok: false, reason: 'owned' };
  if (hero.level < item.unlockLevel) {
    return { ok: false, reason: 'locked', unlockLevel: item.unlockLevel };
  }
  if (hero.gold < item.price) {
    return { ok: false, reason: 'insufficient_gold', goldNeeded: item.price - hero.gold };
  }
  return { ok: true };
}

/** Equips an owned item, replacing whatever was in its slot. */
export function equip(equipped: readonly GearId[], id: GearId): GearId[] {
  const slot = gearItem(id).slot;
  return [...equipped.filter((other) => gearItem(other).slot !== slot), id];
}

export function unequip(equipped: readonly GearId[], id: GearId): GearId[] {
  return equipped.filter((other) => other !== id);
}
