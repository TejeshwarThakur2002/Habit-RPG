// The first sync between this phone and an account (D35, D42, D48). Before it, the normal engine
// must not run: a hero the server has never seen would have its changes refused. A phone with a
// hero uploads its whole history as an import, which the server replays with its own rules; a
// phone without one pulls the account's hero. Only when that worked is the account recorded as
// synced on this phone, and the normal engine takes over. When both have a hero, the player
// chooses which to keep (D49).

import {
  MAX_CHANGES,
  syncResponseSchema,
  type AccountHero,
  type Change,
  type SyncRequest,
  type SyncResponse,
} from '@habit-rpg/shared';
import { asc, eq } from 'drizzle-orm';

import { getProfile } from '../db/queries/hero';
import { deletePlayerData } from '../db/queries/local-data';
import {
  completionChange,
  habitChange,
  inventoryChange,
  profileChange,
} from '../db/queries/outbox';
import { getSettings } from '../db/queries/settings';
import { getSyncState, resetCursor } from '../db/queries/sync-state';
import { completions, habits, inventory, outbox, settings, syncState } from '../db/schema';
import { LOCAL_USER_ID, type AppDb } from '../db/types';
import { applyResponse, rollBack, type Rejection } from './apply';
import { createSyncEngine, type SyncEngineOptions } from './engine';

export type FirstSyncOutcome =
  | { status: 'done'; rejected: Rejection[]; pulledHero: boolean }
  /** The account already has a different hero (named when the server said which). */
  | { status: 'conflict'; accountHero: AccountHero | null }
  | { status: 'offline' | 'error'; message: string };

const user = LOCAL_USER_ID;

/** Signed in to an account this phone hasn't synced with yet (the demo never syncs). */
export function needsFirstSync(db: AppDb, newId: () => string): boolean {
  const { accountUserId, demoMode } = getSettings(db);
  return accountUserId !== null && !demoMode && getSyncState(db, newId).userId !== accountUserId;
}

/**
 * The phone's history as sync changes, in the order the server replays it: the profile, every
 * quest (archived and deleted ones too, so old completions still have their quest), then
 * completions and purchases by when they happened. Undone completions go as they are and count
 * for nothing (D38). Worn gear goes as worn from its purchase, the one time the phone knows (D42).
 */
export function buildImport(db: AppDb): Change[] {
  const profile = getProfile(db, user);
  if (!profile) return [];
  const quests = db
    .select()
    .from(habits)
    .where(eq(habits.userId, user))
    .orderBy(asc(habits.sortOrder))
    .all();
  const done = db.select().from(completions).where(eq(completions.userId, user)).all();
  const items = db.select().from(inventory).where(eq(inventory.userId, user)).all();
  const timed = [
    ...done.map((c) => ({ at: c.completedAt, change: completionChange(c) })),
    ...items.map((i) => ({
      at: i.purchasedAt,
      change: inventoryChange(i, Date.parse(i.purchasedAt)),
    })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return [
    profileChange(profile, Date.parse(profile.createdAt)),
    ...quests.map(habitChange),
    ...timed.map((t) => t.change),
  ];
}

type Options = Omit<SyncEngineOptions, 'setTimer' | 'clearTimer'>;
type Failed = Exclude<FirstSyncOutcome, { status: 'done' }>;
type Uploaded = { status: 'uploaded'; rejected: Rejection[] };
/** The player chose this phone's hero over the account's: the import replaces it (D49). */
export type FirstSyncChoice = { replace?: boolean };

/** One request; a failure as the outcome it leads to. */
async function sendOnce(o: Options, request: SyncRequest): Promise<SyncResponse | Failed> {
  const result = await o.transport.send(request);
  if (!result.ok) {
    if (result.code === 'hero_exists')
      return { status: 'conflict', accountHero: result.hero ?? null };
    return { status: result.kind === 'offline' ? 'offline' : 'error', message: result.message };
  }
  const parsed = syncResponseSchema.safeParse(result.body);
  if (!parsed.success) return { status: 'error', message: 'The server sent something unexpected' };
  return parsed.data;
}

const failed = <T extends object>(r: T | Failed): r is Failed => 'status' in r;

/** Sends the import in batches of 200 (the request limit), the last one marked done. */
async function uploadImport(
  o: Options,
  startedAt: string,
  { replace }: FirstSyncChoice,
): Promise<Uploaded | Failed> {
  const changes = buildImport(o.db);
  const { deviceId } = getSyncState(o.db, o.newId);
  const rejected: Rejection[] = [];
  for (let i = 0; i < changes.length; i += MAX_CHANGES) {
    const done = i + MAX_CHANGES >= changes.length;
    const answer = await sendOnce(o, {
      device_id: deviceId,
      cursor: 0,
      app_version: o.appVersion,
      changes: changes.slice(i, i + MAX_CHANGES),
      import: { started_at: startedAt, done, ...(replace ? { replace } : {}) },
    });
    if (failed(answer)) return answer;
    rejected.push(...answer.rejected);
  }
  return { status: 'uploaded', rejected };
}

function markSynced(db: AppDb, newId: () => string, accountUserId: string): void {
  getSyncState(db, newId);
  db.update(syncState).set({ userId: accountUserId }).where(eq(syncState.id, 1)).run();
}

/**
 * Runs the first sync for `accountUserId`; safe to run again after a failure. With a hero on the
 * phone, the account counts as synced once the import is done, since the server now has the
 * hero and a second import would be refused; without one, only once the pull worked. With
 * `replace`, the import takes the place of the account's hero.
 */
export async function runFirstSync(
  o: Options,
  accountUserId: string,
  choice: FirstSyncChoice = {},
): Promise<FirstSyncOutcome> {
  const { db } = o;
  const profile = getProfile(db, user);
  let rejected: Rejection[] = [];
  if (profile) {
    const uploaded = await uploadImport(o, profile.createdAt, choice);
    if (uploaded.status !== 'uploaded') return uploaded;
    rejected = uploaded.rejected;
    // The import carried everything the outbox held; the pull below brings the server's version.
    db.transaction((tx) => {
      rollBack(tx, rejected);
      tx.delete(outbox).run();
      resetCursor(tx);
      markSynced(tx, o.newId, accountUserId);
    });
  } else {
    resetCursor(db);
  }
  // No retries scheduled from here: the normal triggers (D) take over.
  const pulled = await createSyncEngine({ ...o, setTimer: () => undefined }).syncNow();
  if (pulled.status !== 'synced') return { status: pulled.status, message: pulled.message };
  if (!profile) markSynced(db, o.newId, accountUserId);
  return {
    status: 'done',
    rejected: [...rejected, ...pulled.rejected],
    pulledHero: !profile && getProfile(db, user) !== undefined,
  };
}

/** Every page of the account's rows, from the start; nothing is applied yet. */
async function downloadAccount(o: Options): Promise<SyncResponse[] | Failed> {
  const { deviceId } = getSyncState(o.db, o.newId);
  const pages: SyncResponse[] = [];
  let cursor = 0;
  // A safety stop, as in the engine: 50 pages is 25,000 rows.
  for (let round = 0; round < 50; round++) {
    const page = await sendOnce(o, {
      device_id: deviceId,
      cursor,
      app_version: o.appVersion,
      changes: [],
    });
    if (failed(page)) return page;
    pages.push(page);
    if (!page.has_more) return pages;
    cursor = page.cursor;
  }
  return { status: 'error', message: 'There was too much to download at once' };
}

/**
 * "Use my account's hero" (D48), and the way back for a phone whose hero was replaced from
 * another one (`hero_replaced`, D49). The account's hero is downloaded in full before anything
 * changes, then swapped in for the phone's player data in one transaction, so a dropped
 * connection leaves the phone as it was. Unsent changes for the old hero go with it.
 */
export async function takeAccountHero(
  o: Options,
  accountUserId: string,
): Promise<FirstSyncOutcome> {
  const pages = await downloadAccount(o);
  if (failed(pages)) return pages;
  if (!pages.some((p) => p.changes.some((c) => c.table === 'profiles'))) {
    return { status: 'error', message: "Your account's hero couldn't be found" };
  }
  o.db.transaction((tx) => {
    deletePlayerData(tx);
    // A faint waiting to be shown was the old hero's.
    tx.update(settings).set({ pendingFaint: null }).run();
    for (const page of pages) applyResponse(tx, page, [], o.now());
    markSynced(tx, o.newId, accountUserId);
  });
  return { status: 'done', rejected: [], pulledHero: true };
}
