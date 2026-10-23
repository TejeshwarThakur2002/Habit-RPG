import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous SQLite database with our schema: expo-sqlite on the phone, sql.js in tests.
 * Queries take this type so the same code runs in both (DECISIONS.md D17).
 */
export type AppDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/**
 * The id the phone keys the player's rows by, signed in or not. The phone holds one player, and
 * sync maps this id to the signed-in account (DECISIONS.md D33).
 */
export const LOCAL_USER_ID = 'local';

/** What a faint at day close took, kept until the player has seen the "You fainted" modal. */
export interface FaintNotice {
  /** The local day whose misses brought HP to 0. */
  date: string;
  goldLost: number;
  xpLost: number;
  /** Names of the quests missed that day, for the modal. */
  missed: string[];
}
