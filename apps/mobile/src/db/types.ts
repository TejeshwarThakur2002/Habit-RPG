import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous SQLite database with our schema: expo-sqlite on the phone, sql.js in tests.
 * Queries take this type so the same code runs in both (DECISIONS.md D17).
 */
export type AppDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** The local user's id before sign-in, and in demo mode. */
export const LOCAL_USER_ID = 'local';
