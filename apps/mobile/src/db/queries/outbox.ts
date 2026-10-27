// The outbox (SCOPE.md section 8.2): changes waiting to reach the server. Each one is written in
// the same transaction as the change itself, so a crash can never lose a change or send one
// that didn't happen. Only a signed-in account's changes are queued: the demo never syncs, and
// a hero kept only on this phone is uploaded from its tables when it is linked (D42, D45).

import type { Change } from '@habit-rpg/shared';
import { and, asc, count, eq } from 'drizzle-orm';

import { outbox, type completions, type habits, type inventory } from '../schema';
import type { AppDb } from '../types';
import type { Profile } from './hero';
import { getSettings } from './settings';

const iso = (ms: number) => new Date(ms).toISOString();

/** The outbox in the order it is sent, for the dev outbox screen (D54). */
export function listOutbox(db: AppDb) {
  return db.select().from(outbox).orderBy(asc(outbox.id)).all();
}

/** Changes the server hasn't settled yet: "N waiting" in the sync pill and card. */
export function countWaiting(db: AppDb): number {
  return db.select({ n: count() }).from(outbox).get()?.n ?? 0;
}

/**
 * Queues one change. A newer version of a row replaces an older one that hasn't been sent yet
 * (attempts = 0), keeping its place in the queue, so the server sees rows in the order they
 * were first changed and only their latest state. Rows already sent are never touched.
 */
export function enqueue(tx: AppDb, change: Change, now: number): void {
  const { accountUserId, demoMode } = getSettings(tx);
  if (accountUserId === null || demoMode) return;

  const unsentUpsert = and(
    eq(outbox.tableName, change.table),
    eq(outbox.rowId, change.id),
    eq(outbox.op, 'upsert'),
    eq(outbox.attempts, 0),
  );
  if (change.op === 'upsert') {
    const pending = tx.select({ id: outbox.id }).from(outbox).where(unsentUpsert).get();
    if (pending) {
      tx.update(outbox).set({ payload: change }).where(eq(outbox.id, pending.id)).run();
      return;
    }
  } else {
    // An undone purchase supersedes its unsent upserts. The delete itself is still sent: an
    // earlier version may have reached the server, and an unknown id is a no-op there (D39).
    tx.delete(outbox).where(unsentUpsert).run();
  }
  tx.insert(outbox)
    .values({
      tableName: change.table,
      rowId: change.id,
      op: change.op,
      payload: change,
      createdAt: iso(now),
    })
    .run();
}

// Local rows in the wire format of packages/shared (snake_case, only what the player controls).

export function profileChange(profile: Profile, now: number): Change {
  return {
    table: 'profiles',
    op: 'upsert',
    id: 'me',
    data: { hero_name: profile.heroName, class: profile.heroClass, timezone: profile.timezone },
    client_updated_at: iso(now),
  };
}

export function habitChange(row: typeof habits.$inferSelect): Change {
  return {
    table: 'habits',
    op: 'upsert',
    id: row.id,
    data: {
      name: row.name,
      type: row.type,
      difficulty: row.difficulty,
      category: row.category,
      weekdays: row.weekdays,
      reminder_time: row.reminderTime,
      sort_order: row.sortOrder,
      created_date: row.createdDate,
      archived_at: row.archivedAt,
      deleted_at: row.deletedAt,
    },
    client_updated_at: row.clientUpdatedAt,
  };
}

/** The server works out the reward itself, so only the habit, the day and the times go. */
export function completionChange(row: typeof completions.$inferSelect): Change {
  return {
    table: 'completions',
    op: 'upsert',
    id: row.id,
    data: {
      habit_id: row.habitId,
      local_date: row.localDate,
      completed_at: row.completedAt,
      undone_at: row.undoneAt,
    },
    client_updated_at: row.undoneAt ?? row.completedAt,
  };
}

export function inventoryChange(row: typeof inventory.$inferSelect, now: number): Change {
  return {
    table: 'inventory',
    op: 'upsert',
    id: row.id,
    data: { item_id: row.itemId, equipped: row.equipped, purchased_at: row.purchasedAt },
    client_updated_at: iso(now),
  };
}

export function undoPurchaseChange(inventoryId: string, now: number): Change {
  return { table: 'inventory', op: 'delete', id: inventoryId, client_updated_at: iso(now) };
}
