import { gearItem } from '@habit-rpg/game-core';

import { gearEffect, shopState } from '../gear-text';

describe('gearEffect', () => {
  it('reads like the shop rows in SCOPE.md section 5.6', () => {
    expect(gearEffect(gearItem('oak-shield'))).toBe('+2 CON · blocks 1 missed daily');
    expect(gearEffect(gearItem('wizard-hat'))).toBe('+3 INT · 10% more XP from Mind habits');
    expect(gearEffect(gearItem('leather-boots'))).toBe('+1 STR, +1 CON');
  });
});

describe('shopState', () => {
  const hero = { level: 3, gold: 50 };

  it('follows canBuy for items not yet owned', () => {
    expect(shopState(gearItem('oak-shield'), hero, [])).toEqual({ kind: 'buyable' });
    expect(shopState(gearItem('wizard-hat'), hero, [])).toEqual({
      kind: 'expensive',
      goldNeeded: 25,
    });
    expect(shopState(gearItem('dragon-cape'), hero, [])).toEqual({
      kind: 'locked',
      unlockLevel: 10,
    });
  });

  it('shows owned items as Equip or Equipped', () => {
    const inventory = [
      { itemId: 'oak-shield' as const, equipped: true },
      { itemId: 'iron-sword' as const, equipped: false },
    ];
    expect(shopState(gearItem('oak-shield'), hero, inventory)).toEqual({ kind: 'equipped' });
    expect(shopState(gearItem('iron-sword'), hero, inventory)).toEqual({ kind: 'owned' });
  });
});
