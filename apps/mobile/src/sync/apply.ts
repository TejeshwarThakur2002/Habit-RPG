// Applying one sync response (SCOPE.md section 8.3, client step 3), all in one transaction:
// settle the outbox rows that were sent, write the pulled rows, take the server's hero and
// store the new cursor. A crash part-way leaves the phone exactly as it was before.

import type { ServerChange, SyncResponse } from '@habit-rpg/shared';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';

import { saveCursor } from '../db/queries/sync-state';
import * as t from '../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../db/types';

/** An outbox row that went out in the request. */
export interface SentRow {
  outboxId: number;
  rowId: string;
}

export type Rejection = SyncResponse['rejected'][number];

const user = LOCAL_USER_ID;
const key = (table: string, id: string) => `${table}:${id}`;

/**
 * Removes the sent rows the server settled (applied or rejected). Only those: a newer version
 * written during the sync is a different outbox row and stays queued (D45).
 */
function settle(tx: AppDb, response: SyncResponse, sent: readonly SentRow[]): void {
  const settled = new Set([...response.applied, ...response.rejected.map((r) => r.id)]);
  const done = sent.filter((row) => settled.has(row.rowId)).map((row) => row.outboxId);
  if (done.length > 0) tx.delete(t.outbox).where(inArray(t.outbox.id, done)).run();
}

/**
 * Undoes on the phone what the server refused (SCOPE.md section 8.3). Only rows the server never
 * confirmed (no server_seq) go: a refused edit to a row the server already has leaves that row
 * for the server's version. The hero needs nothing here: the server's hero, applied below,
 * never included the refused change.
 */
function rollBack(tx: AppDb, rejected: readonly Rejection[]): void {
  for (const { table, id } of rejected) {
    if (table === 'completions') {
      tx.delete(t.completions)
        .where(and(eq(t.completions.id, id), isNull(t.completions.serverSeq)))
        .run();
    } else if (table === 'inventory') {
      tx.delete(t.inventory)
        .where(and(eq(t.inventory.id, id), isNull(t.inventory.serverSeq)))
        .run();
    } else if (table === 'habits') {
      const unknown = and(eq(t.habits.id, id), isNull(t.habits.serverSeq));
      if (tx.select({ id: t.habits.id }).from(t.habits).where(unknown).get()) {
        tx.delete(t.completions).where(eq(t.completions.habitId, id)).run();
        tx.delete(t.habits).where(unknown).run();
      }
    }
  }
}

/** Rows the phone still has unsent changes for: the phone's newer version wins until sent. */
function pendingKeys(tx: AppDb): Set<string> {
  const rows = tx.select({ table: t.outbox.tableName, id: t.outbox.rowId }).from(t.outbox).all();
  return new Set(rows.map((r) => key(r.table, r.id)));
}

/** The id the outbox uses for this row: the profile is always 'me' (D35); day closures are never sent. */
function outboxRowId(change: Extract<ServerChange, { op: 'upsert' }>): string | null {
  if (change.table === 'profiles') return 'me';
  return change.table === 'day_closures' ? null : change.data.id;
}

function applyCompletion(tx: AppDb, d: Extract<ServerChange, { table: 'completions' }>['data']) {
  // An active server completion beats a local one for the same quest and day: the server keeps
  // the earliest and will refuse the phone's as a duplicate (D38).
  if (d.undone_at === null) {
    tx.update(t.completions)
      .set({ undoneAt: d.completed_at })
      .where(
        and(
          eq(t.completions.habitId, d.habit_id),
          eq(t.completions.localDate, d.local_date),
          isNull(t.completions.undoneAt),
          ne(t.completions.id, d.id),
        ),
      )
      .run();
  }
  const values = {
    habitId: d.habit_id,
    localDate: d.local_date,
    completedAt: d.completed_at,
    undoneAt: d.undone_at,
    category: d.category,
    xpAwarded: d.xp_awarded,
    goldAwarded: d.gold_awarded,
    bossDamage: d.boss_damage,
    isLate: d.is_late,
    serverSeq: d.server_seq,
  };
  tx.insert(t.completions)
    .values({ id: d.id, userId: user, ...values })
    .onConflictDoUpdate({ target: t.completions.id, set: values })
    .run();
}

function applyChange(tx: AppDb, change: ServerChange, pending: Set<string>): void {
  if (change.op === 'delete') {
    tx.delete(t.inventory).where(eq(t.inventory.id, change.id)).run();
    return;
  }
  const rowId = outboxRowId(change);
  if (rowId !== null && pending.has(key(change.table, rowId))) return;

  switch (change.table) {
    case 'profiles': {
      const d = change.data;
      const values = { heroName: d.hero_name, heroClass: d.class, timezone: d.timezone };
      tx.insert(t.profiles)
        .values({ id: user, createdAt: d.created_at, ...values })
        .onConflictDoUpdate({ target: t.profiles.id, set: values })
        .run();
      return;
    }
    case 'habits': {
      const d = change.data;
      const values = {
        name: d.name,
        type: d.type,
        difficulty: d.difficulty,
        category: d.category,
        weekdays: d.weekdays,
        reminderTime: d.reminder_time,
        sortOrder: d.sort_order,
        createdDate: d.created_date,
        archivedAt: d.archived_at,
        deletedAt: d.deleted_at,
        clientUpdatedAt: d.client_updated_at,
        serverSeq: d.server_seq,
      };
      tx.insert(t.habits)
        .values({ id: d.id, userId: user, ...values })
        .onConflictDoUpdate({ target: t.habits.id, set: values })
        .run();
      return;
    }
    case 'completions':
      applyCompletion(tx, change.data);
      return;
    case 'inventory': {
      const d = change.data;
      // Bought on two phones: the server kept one, so a local copy under another id goes.
      tx.delete(t.inventory)
        .where(and(eq(t.inventory.itemId, d.item_id), ne(t.inventory.id, d.id)))
        .run();
      const values = { itemId: d.item_id, equipped: d.equipped, purchasedAt: d.purchased_at };
      tx.insert(t.inventory)
        .values({ id: d.id, userId: user, serverSeq: d.server_seq, ...values })
        .onConflictDoUpdate({ target: t.inventory.id, set: { ...values, serverSeq: d.server_seq } })
        .run();
      return;
    }
    case 'day_closures': {
      const d = change.data;
      const values = { closedAt: d.closed_at, hpLost: d.hp_lost, missed: d.missed };
      tx.insert(t.dayClosures)
        .values({ userId: user, localDate: d.local_date, ...values })
        .onConflictDoUpdate({
          target: [t.dayClosures.userId, t.dayClosures.localDate],
          set: values,
        })
        .run();
      return;
    }
  }
}

/** Applies a validated response; returns what the server refused, for the player's notices. */
export function applyResponse(
  db: AppDb,
  response: SyncResponse,
  sent: readonly SentRow[],
  now: number,
): Rejection[] {
  return db.transaction((tx) => {
    settle(tx, response, sent);
    rollBack(tx, response.rejected);
    const pending = pendingKeys(tx);
    for (const change of response.changes) applyChange(tx, change, pending);
    const c = response.character;
    const hero = {
      level: c.level,
      xpInLevel: c.xp_in_level,
      hp: c.hp,
      gold: c.gold,
      currentStreak: c.current_streak,
      longestStreak: c.longest_streak,
      lastClosedDate: c.last_closed_date,
    };
    // The server's hero replaces the phone's estimate (section 8.3).
    tx.insert(t.characters)
      .values({ userId: user, ...hero })
      .onConflictDoUpdate({ target: t.characters.userId, set: hero })
      .run();
    saveCursor(tx, response.cursor, now);
    return response.rejected;
  });
}
