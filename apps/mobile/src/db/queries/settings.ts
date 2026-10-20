import { eq } from 'drizzle-orm';

import { settings } from '../schema';
import type { AppDb } from '../types';

export type Settings = typeof settings.$inferSelect;
type SettingsPatch = Partial<Omit<Settings, 'id'>>;

const ROW_ID = 1;

/** The single settings row, created with defaults the first time it is read. */
export function getSettings(db: AppDb): Settings {
  db.insert(settings).values({ id: ROW_ID }).onConflictDoNothing().run();
  const row = db.select().from(settings).where(eq(settings.id, ROW_ID)).get();
  if (!row) throw new Error('settings row missing after insert');
  return row;
}

export function updateSettings(db: AppDb, patch: SettingsPatch): Settings {
  getSettings(db);
  db.update(settings).set(patch).where(eq(settings.id, ROW_ID)).run();
  return getSettings(db);
}
