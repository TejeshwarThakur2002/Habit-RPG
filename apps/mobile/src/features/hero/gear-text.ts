import { canBuy, type GearId, type GearItem, type StatName } from '@habit-rpg/game-core';
import type { ShopItemState } from '@habit-rpg/ui';

const CATEGORY_NAMES = { body: 'Body', mind: 'Mind', health: 'Health', none: 'any' } as const;

/** "+2 CON · blocks 1 missed daily" (SCOPE.md section 5.6), built from the item's data. */
export function gearEffect(item: GearItem): string {
  const stats = (Object.entries(item.stats) as [StatName, number][])
    .map(([stat, value]) => `+${value} ${stat}`)
    .join(', ');
  const extras = [
    item.blocksMisses ? `blocks ${item.blocksMisses} missed daily` : null,
    item.xpBonus
      ? `${item.xpBonus.percent}% more XP from ${CATEGORY_NAMES[item.xpBonus.category]} habits`
      : null,
  ].filter((part): part is string => part !== null);
  return [stats, ...extras].join(' · ');
}

/** How the shop row looks and what its button does, from game-core's canBuy. */
export function shopState(
  item: GearItem,
  hero: { level: number; gold: number },
  inventory: readonly { itemId: GearId; equipped: boolean }[],
): ShopItemState {
  const row = inventory.find((r) => r.itemId === item.id);
  if (row) return { kind: row.equipped ? 'equipped' : 'owned' };
  const check = canBuy(
    item.id,
    hero,
    inventory.map((r) => r.itemId),
  );
  if (check.ok) return { kind: 'buyable' };
  if (check.reason === 'locked') return { kind: 'locked', unlockLevel: check.unlockLevel };
  if (check.reason === 'insufficient_gold') {
    return { kind: 'expensive', goldNeeded: check.goldNeeded };
  }
  return { kind: 'owned' };
}

/** The stat chip tooltips: how each stat grows and what it does (SCOPE.md section 3). */
export const STAT_HELP: Readonly<Record<StatName, string>> = {
  STR: 'STR grows by 1 for every 5 Body habits you finish. It makes each finished habit hit the party boss harder.',
  INT: 'INT grows by 1 for every 5 Mind habits you finish. It adds a little XP to every habit.',
  CON: 'CON grows by 1 for every 5 Health habits you finish. Each point adds 1 to your max HP.',
  LUCK: 'LUCK is half your longest streak. Each point is a 1% chance (up to 25%) of double gold.',
};
