import { eq } from 'drizzle-orm';

import { counterIds, createTestDb } from '../../test/test-db';
import { buyGear, listInventory, setEquipped, undoPurchase } from '../queries/gear';
import { getCharacter, listEquippedGear } from '../queries/hero';
import { createHero } from '../queries/local-data';
import { heroStatsFor } from '../queries/quest-board';
import { characters } from '../schema';
import { LOCAL_USER_ID, type AppDb } from '../types';

const NOW = Date.parse('2026-10-22T18:00:00Z');
const user = LOCAL_USER_ID;

let db: AppDb;
let newId: () => string;
beforeEach(async () => {
  db = await createTestDb();
  newId = counterIds();
  createHero(db, { heroName: 'Ada', heroClass: 'knight', timeZone: 'America/Toronto', now: NOW });
});

const setHero = (patch: Partial<typeof characters.$inferInsert>) =>
  db.update(characters).set(patch).where(eq(characters.userId, user)).run();
const buy = (itemId: Parameters<typeof buyGear>[1]['itemId']) =>
  buyGear(db, { userId: user, itemId, now: NOW, newId });

describe('buyGear', () => {
  it('takes the gold and adds the item, not yet equipped', () => {
    setHero({ gold: 100 });
    const result = buy('oak-shield');

    expect(result.ok).toBe(true);
    expect(getCharacter(db, user)?.gold).toBe(60);
    expect(listInventory(db, user)).toMatchObject([{ itemId: 'oak-shield', equipped: false }]);
  });

  it('refuses with the reason the shop shows', () => {
    setHero({ gold: 30 });
    expect(buy('oak-shield')).toEqual({ ok: false, reason: 'insufficient_gold', goldNeeded: 10 });
    expect(buy('dragon-cape')).toEqual({ ok: false, reason: 'locked', unlockLevel: 10 });

    setHero({ gold: 100 });
    buy('oak-shield');
    expect(buy('oak-shield')).toEqual({ ok: false, reason: 'owned' });
    expect(getCharacter(db, user)?.gold).toBe(60);
  });
});

describe('undoPurchase', () => {
  it('gives the gold back and removes the item, even if it was put on', () => {
    setHero({ gold: 100 });
    const result = buy('oak-shield');
    if (!result.ok) throw new Error('expected the purchase to succeed');
    setEquipped(db, user, 'oak-shield', true, NOW);

    undoPurchase(db, user, result.inventoryId, NOW);
    expect(getCharacter(db, user)?.gold).toBe(100);
    expect(listInventory(db, user)).toEqual([]);
  });
});

describe('setEquipped', () => {
  it('changes the stats at once and keeps one item per slot', () => {
    setHero({ gold: 500, level: 10 });
    buy('oak-shield');
    buy('dragon-cape');
    const conBefore = heroStatsFor(db, user).CON;

    setEquipped(db, user, 'oak-shield', true, NOW);
    setEquipped(db, user, 'dragon-cape', true, NOW);
    expect(heroStatsFor(db, user).CON).toBe(conBefore + 2);
    expect(listEquippedGear(db, user).sort()).toEqual(['dragon-cape', 'oak-shield']);

    setEquipped(db, user, 'oak-shield', false, NOW);
    expect(listEquippedGear(db, user)).toEqual(['dragon-cape']);
  });

  it('lowers HP to the new maximum when CON goes down', () => {
    setHero({ gold: 100 });
    buy('oak-shield');
    setEquipped(db, user, 'oak-shield', true, NOW);
    const { maxHp } = heroStatsFor(db, user);
    setHero({ hp: maxHp });

    setEquipped(db, user, 'oak-shield', false, NOW);
    expect(getCharacter(db, user)?.hp).toBe(maxHp - 2);
  });

  it('ignores items the hero does not own', () => {
    setEquipped(db, user, 'iron-sword', true, NOW);
    expect(listEquippedGear(db, user)).toEqual([]);
  });
});
