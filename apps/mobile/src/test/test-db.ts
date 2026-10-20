import path from 'node:path';

import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import initSqlJs from 'sql.js';

import * as schema from '../db/schema';
import type { AppDb } from '../db/types';

/**
 * A fresh in-memory SQLite database with every migration applied. sql.js is SQLite compiled
 * to WebAssembly, so query tests run the same SQL as the phone without native code (D17).
 */
export async function createTestDb(): Promise<AppDb> {
  const SQL = await initSqlJs();
  const db = drizzle(new SQL.Database(), { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'db', 'migrations') });
  return db;
}

/** Predictable ids for tests: id-1, id-2, ... */
export function counterIds(): () => string {
  let n = 0;
  return () => `id-${(n += 1)}`;
}
