// The phone's sync position (SCOPE.md section 8.2): one row with the pull cursor and this
// phone's device id. The cursor belongs to the account's data, so wiping the player resets it.

import { eq } from 'drizzle-orm';

import { syncState } from '../schema';
import type { AppDb } from '../types';

export type SyncState = typeof syncState.$inferSelect;

const ROW_ID = 1;

/** The sync row, created on first use with a new device id. */
export function getSyncState(db: AppDb, newId: () => string): SyncState {
  db.insert(syncState).values({ id: ROW_ID, deviceId: newId() }).onConflictDoNothing().run();
  const row = db.select().from(syncState).where(eq(syncState.id, ROW_ID)).get();
  if (!row) throw new Error('sync_state row missing after insert');
  return row;
}

export function saveCursor(db: AppDb, cursor: number, at: number): void {
  db.update(syncState)
    .set({ cursor, lastSyncAt: new Date(at).toISOString() })
    .where(eq(syncState.id, ROW_ID))
    .run();
}

/** Back to the start: the next sync pulls everything the account has (a new or wiped player). */
export function resetCursor(db: Pick<AppDb, 'update'>): void {
  db.update(syncState).set({ cursor: 0, lastSyncAt: null }).where(eq(syncState.id, ROW_ID)).run();
}
