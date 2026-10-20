import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';
import type { AppDb } from './types';

// The change listener lets Drizzle's useLiveQuery repaint screens after every write.
const expoDb = openDatabaseSync('habit-rpg.db', { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });

// Compile-time check that the phone database fits the shared query type.
const _shared: AppDb = db;
void _shared;
