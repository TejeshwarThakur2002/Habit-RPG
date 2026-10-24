// Pushing gear (SCOPE.md section 8.3, conflict rules): a purchase is checked against the
// server's own level, gold and items, undoing one refunds the price, and `equipped` is last
// write wins by the phone's client_updated_at. Gold and HP move only through the event log
// (DECISIONS.md D39).

import type { TransactionSql } from 'postgres';

import {
  canBuy,
  equip,
  gearItem,
  unequip,
  type BuyCheck,
  type GearId,
} from '../_shared/game-core/index.ts';
import type { Change, RejectionReason } from '../_shared/shared/index.ts';
import { changeHero, loadHero, loadStats } from '../_server/hero.ts';
import type { Outcome } from './push-habits.ts';

type InventoryChange = Extract<Change, { table: 'inventory' }>;
type Purchase = Extract<InventoryChange, { op: 'upsert' }>;

const REFUSED: Record<Exclude<BuyCheck, { ok: true }>['reason'], RejectionReason> = {
  insufficient_gold: 'insufficient_gold',
  // Two phones bought the same item offline: the first to sync keeps it.
  owned: 'duplicate',
  locked: 'invalid',
};

/** The player's items, without undone purchases. */
async function ownedItems(sql: TransactionSql, userId: string) {
  const rows = await sql`
    select id, item_id, equipped from public.inventory
    where user_id = ${userId} and deleted_at is null`;
  return rows.map((r) => ({
    id: r.id as string,
    itemId: r.item_id as GearId,
    equipped: r.equipped as boolean,
  }));
}

/**
 * Lowers HP to the max HP the hero's gear now gives, since HP never exceeds it (D25). The
 * event's ref is the change that took the gear off, so a retry can't lower it twice.
 */
async function fitHp(sql: TransactionSql, userId: string, ref: string): Promise<void> {
  const state = await loadHero(sql, userId);
  if (!state) return;
  const { stats } = await loadStats(sql, userId, state.longestStreak);
  if (state.hero.hp <= stats.maxHp) return;
  await changeHero(sql, userId, { kind: 'equip', ref }, state.hero, {
    ...state.hero,
    hp: stats.maxHp,
  });
}

/**
 * Puts an owned item on or takes it off with game-core's `equip` (one item per slot). Every
 * row that changes takes the incoming time, so an older change from another phone loses.
 */
async function setEquipped(
  sql: TransactionSql,
  userId: string,
  id: string,
  on: boolean,
  at: string,
): Promise<void> {
  const items = await ownedItems(sql, userId);
  const target = items.find((item) => item.id === id);
  if (!target) return;
  const worn = items.filter((item) => item.equipped).map((item) => item.itemId);
  const next = on ? equip(worn, target.itemId) : unequip(worn, target.itemId);
  for (const item of items) {
    const equipped = next.includes(item.itemId);
    if (item.id === id || equipped !== item.equipped) {
      await sql`
        update public.inventory set equipped = ${equipped}, client_updated_at = ${at}
        where id = ${item.id}`;
    }
  }
  await fitHp(sql, userId, `${id}@${at}`);
}

async function buy(sql: TransactionSql, userId: string, change: Purchase): Promise<Outcome> {
  // A phone always pushes its profile, and so its hero, first.
  const state = await loadHero(sql, userId);
  if (!state) return { applied: false, reason: 'invalid' };
  const { item_id: itemId, purchased_at: purchasedAt, equipped } = change.data;
  const owned = (await ownedItems(sql, userId)).map((item) => item.itemId);
  const check = canBuy(itemId, state.hero, owned);
  if (!check.ok) return { applied: false, reason: REFUSED[check.reason] };

  await sql`
    insert into public.inventory (id, user_id, item_id, equipped, purchased_at, client_updated_at)
    values (${change.id}, ${userId}, ${itemId}, false, ${purchasedAt}, ${change.client_updated_at})`;
  const gold = state.hero.gold - gearItem(itemId).price;
  await changeHero(sql, userId, { kind: 'purchase', ref: change.id }, state.hero, {
    ...state.hero,
    gold,
  });
  // Bought and put on before this sync: one outbox row can carry both.
  if (equipped) await setEquipped(sql, userId, change.id, true, change.client_updated_at);
  return { applied: true };
}

/** Undo (the shop's toast): the row becomes a tombstone and the price comes back. */
async function refund(
  sql: TransactionSql,
  userId: string,
  id: string,
  at: string,
): Promise<Outcome> {
  const [row] = await sql`
    update public.inventory set equipped = false, deleted_at = ${at}, client_updated_at = ${at}
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning item_id`;
  // Already undone, or never bought here (a refused purchase): nothing to give back.
  if (!row) return { applied: true };
  const state = await loadHero(sql, userId);
  if (!state) return { applied: true };
  const { stats } = await loadStats(sql, userId, state.longestStreak);
  await changeHero(sql, userId, { kind: 'refund', ref: id }, state.hero, {
    ...state.hero,
    gold: state.hero.gold + gearItem(row.item_id as GearId).price,
    hp: Math.min(state.hero.hp, stats.maxHp),
  });
  return { applied: true };
}

export async function pushInventory(
  sql: TransactionSql,
  userId: string,
  change: InventoryChange,
): Promise<Outcome> {
  const [current] = await sql`
    select user_id, item_id, client_updated_at, deleted_at
    from public.inventory where id = ${change.id}`;
  // A UUID taken by another player's item is refused, never touched.
  if (current && current.user_id !== userId) return { applied: false, reason: 'invalid' };
  if (change.op === 'delete') return await refund(sql, userId, change.id, change.client_updated_at);
  if (!current) return await buy(sql, userId, change);
  if (current.item_id !== change.data.item_id) return { applied: false, reason: 'invalid' };

  // An undone purchase stays undone, and an older equip loses; either way the row is
  // re-stamped so the phone pulls the winning version on this sync (as for habits, D37).
  const serverWins =
    current.deleted_at !== null ||
    new Date(change.client_updated_at) < (current.client_updated_at as Date);
  if (serverWins) {
    await sql`update public.inventory set id = id where id = ${change.id}`;
    return { applied: true };
  }
  await setEquipped(sql, userId, change.id, change.data.equipped, change.client_updated_at);
  return { applied: true };
}
