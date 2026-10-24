// The gear shop (SCOPE.md F5). Items are bought once with gold earned from habits, then
// equipped or unequipped for free; one item per slot. All rules come from game-core.

import { canBuy, equip, gearItem, unequip, type BuyCheck, type GearId } from '@habit-rpg/game-core';
import { and, eq } from 'drizzle-orm';

import { characters, inventory } from '../schema';
import type { AppDb } from '../types';
import { getCharacter, getProfile } from './hero';
import { enqueue, inventoryChange, undoPurchaseChange } from './outbox';
import { heroStatsFor } from './quest-board';

export type InventoryRow = typeof inventory.$inferSelect;

export function listInventory(db: AppDb, userId: string): InventoryRow[] {
  return db.select().from(inventory).where(eq(inventory.userId, userId)).all();
}

export type BuyResult = { ok: true; inventoryId: string } | Exclude<BuyCheck, { ok: true }>;

/** Takes the gold and adds the item, unequipped. Refuses with game-core's reason otherwise. */
export function buyGear(
  db: AppDb,
  input: { userId: string; itemId: GearId; now: number; newId: () => string },
): BuyResult {
  return db.transaction((tx) => {
    const character = getCharacter(tx, input.userId);
    if (!character) throw new Error('buyGear: no hero yet');
    const owned = listInventory(tx, input.userId).map((row) => row.itemId);
    const check = canBuy(input.itemId, character, owned);
    if (!check.ok) return check;

    const inventoryId = input.newId();
    tx.insert(inventory)
      .values({
        id: inventoryId,
        userId: input.userId,
        itemId: input.itemId,
        purchasedAt: new Date(input.now).toISOString(),
      })
      .run();
    tx.update(characters)
      .set({ gold: character.gold - gearItem(input.itemId).price })
      .where(eq(characters.userId, input.userId))
      .run();
    queueItem(tx, inventoryId, input.now);
    return { ok: true, inventoryId };
  });
}

/** The toast's Undo (SCOPE.md section 5.6): gives the gold back and removes the item. */
export function undoPurchase(db: AppDb, userId: string, inventoryId: string, now: number): void {
  db.transaction((tx) => {
    const row = tx
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.userId, userId)))
      .get();
    const character = getCharacter(tx, userId);
    if (!row || !character) return;
    if (row.equipped) setEquipped(tx, userId, row.itemId, false, now);

    tx.delete(inventory).where(eq(inventory.id, inventoryId)).run();
    enqueue(tx, undoPurchaseChange(inventoryId, now), now);
    tx.update(characters)
      .set({ gold: character.gold + gearItem(row.itemId).price })
      .where(eq(characters.userId, userId))
      .run();
  });
}

/**
 * Equips an owned item (taking off whatever shares its slot) or takes it off. Stats change
 * at once; if max HP drops (less CON), HP is lowered to fit, since HP never exceeds max.
 */
export function setEquipped(
  db: AppDb,
  userId: string,
  itemId: GearId,
  on: boolean,
  now: number,
): void {
  db.transaction((tx) => {
    const rows = listInventory(tx, userId);
    if (!rows.some((row) => row.itemId === itemId)) return;
    const current = rows.filter((row) => row.equipped).map((row) => row.itemId);
    const next = on ? equip(current, itemId) : unequip(current, itemId);

    for (const row of rows) {
      const equipped = next.includes(row.itemId);
      if (equipped !== row.equipped) {
        tx.update(inventory).set({ equipped }).where(eq(inventory.id, row.id)).run();
        queueItem(tx, row.id, now);
      }
    }

    const character = getCharacter(tx, userId);
    const { maxHp } = heroStatsFor(tx, userId);
    if (character && character.hp > maxHp) {
      tx.update(characters).set({ hp: maxHp }).where(eq(characters.userId, userId)).run();
    }
  });
}

/** Everything the Hero tab shows (SCOPE.md section 5.6), read in one pass. */
export function getHeroSheet(db: AppDb, userId: string) {
  const profile = getProfile(db, userId);
  const character = getCharacter(db, userId);
  if (!profile || !character) return null;
  return {
    heroName: profile.heroName,
    heroClass: profile.heroClass,
    level: character.level,
    gold: character.gold,
    stats: heroStatsFor(db, userId),
    inventory: listInventory(db, userId).map(({ itemId, equipped }) => ({ itemId, equipped })),
  };
}

export type HeroSheet = NonNullable<ReturnType<typeof getHeroSheet>>;

function queueItem(tx: AppDb, inventoryId: string, now: number): void {
  const row = tx.select().from(inventory).where(eq(inventory.id, inventoryId)).get();
  if (row) enqueue(tx, inventoryChange(row, now), now);
}
