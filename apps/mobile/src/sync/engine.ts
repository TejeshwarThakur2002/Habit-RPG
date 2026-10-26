// The sync engine (SCOPE.md section 8.3, client algorithm). It sends the outbox in batches with
// the pull cursor and applies each response in one transaction, until nothing is left to send
// or pull. Only one sync runs at a time; on a network or server error the outbox is kept and a
// retry is scheduled with exponential backoff. It talks to the server only through a transport,
// so tests use a fake server (D46).

import { syncResponseSchema, type AccountHero, type SyncRequest } from '@habit-rpg/shared';
import { asc, count, inArray, sql } from 'drizzle-orm';

import { getSyncState } from '../db/queries/sync-state';
import { outbox } from '../db/schema';
import type { AppDb } from '../db/types';
import { applyResponse, type Rejection, type SentRow } from './apply';

/** SCOPE.md section 8.3: up to 100 outbox rows per request. */
export const BATCH_SIZE = 100;
/** A safety stop: 50 rounds is 5,000 changes or 25,000 pulled rows in one go. */
const MAX_ROUNDS = 50;

export type TransportResult =
  | { ok: true; body: unknown }
  /** offline: no answer at all; server: 5xx; refused: 4xx, which a retry won't fix. */
  | {
      ok: false;
      kind: 'offline' | 'server' | 'refused';
      status?: number;
      /** The server's error code, e.g. `hero_exists` (D42). */
      code?: string;
      /** With `hero_exists`: the account's hero (D49). */
      hero?: AccountHero;
      message: string;
    };

export interface SyncTransport {
  send(request: SyncRequest): Promise<TransportResult>;
}

export type SyncOutcome =
  | { status: 'synced'; rejected: Rejection[] }
  | {
      status: 'offline' | 'error';
      message: string;
      /** When the next attempt is scheduled, or null when only a new trigger will retry. */
      retryInMs: number | null;
      rejected: Rejection[];
      /** A refusal's code, e.g. `hero_replaced`, which the caller acts on (D49). */
      code?: string;
    };

export interface SyncEngineOptions {
  db: AppDb;
  transport: SyncTransport;
  appVersion: string;
  newId: () => string;
  now: () => number;
  /** Timers are passed in so tests control the backoff. */
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** 2 s, 4 s, 8 s ... capped at 5 minutes (section 8.3). `failures` counts from 1. */
export function retryDelayMs(failures: number): number {
  return Math.min(2000 * 2 ** (failures - 1), 300_000);
}

/** The next batch, oldest first, marked as sent before the request so it is never rewritten. */
function takeBatch(db: AppDb) {
  return db.transaction((tx) => {
    const rows = tx.select().from(outbox).orderBy(asc(outbox.id)).limit(BATCH_SIZE).all();
    if (rows.length > 0) {
      tx.update(outbox)
        .set({ attempts: sql`${outbox.attempts} + 1` })
        .where(
          inArray(
            outbox.id,
            rows.map((r) => r.id),
          ),
        )
        .run();
    }
    return rows;
  });
}

function waiting(db: AppDb): number {
  return db.select({ n: count() }).from(outbox).get()?.n ?? 0;
}

export function createSyncEngine(options: SyncEngineOptions) {
  const { db, transport, newId, now } = options;
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer =
    options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let running: Promise<SyncOutcome> | null = null;
  let failures = 0;
  let timer: unknown = null;

  function fail(
    message: string,
    kind: 'offline' | 'error',
    retry: boolean,
    rejected: Rejection[],
    code?: string,
  ) {
    failures += 1;
    const retryInMs = retry ? retryDelayMs(failures) : null;
    if (retryInMs !== null) timer = setTimer(() => void syncNow(), retryInMs);
    return {
      status: kind,
      message,
      retryInMs,
      rejected,
      ...(code ? { code } : {}),
    } satisfies SyncOutcome;
  }

  async function run(): Promise<SyncOutcome> {
    const rejected: Rejection[] = [];
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const state = getSyncState(db, newId);
      const rows = takeBatch(db);
      const result = await transport.send({
        device_id: state.deviceId,
        cursor: state.cursor,
        app_version: options.appVersion,
        changes: rows.map((r) => r.payload),
      });
      if (!result.ok) {
        db.update(outbox)
          .set({ lastError: result.message })
          .where(
            inArray(
              outbox.id,
              rows.map((r) => r.id),
            ),
          )
          .run();
        const offline = result.kind === 'offline';
        return fail(
          result.message,
          offline ? 'offline' : 'error',
          result.kind !== 'refused',
          rejected,
          result.code,
        );
      }
      const parsed = syncResponseSchema.safeParse(result.body);
      if (!parsed.success) {
        console.warn('sync: the server sent an unexpected response', parsed.error.issues);
        return fail('The server sent something unexpected', 'error', true, rejected);
      }
      const sent: SentRow[] = rows.map((r) => ({ outboxId: r.id, rowId: r.rowId }));
      rejected.push(...applyResponse(db, parsed.data, sent, now()));
      if (!parsed.data.has_more && waiting(db) === 0) {
        failures = 0;
        return { status: 'synced', rejected };
      }
    }
    return fail('Sync stopped after too many rounds', 'error', true, rejected);
  }

  /** Runs a sync, or joins the one already running. Cancels any scheduled retry. */
  function syncNow(): Promise<SyncOutcome> {
    if (running) return running;
    if (timer !== null) clearTimer(timer);
    timer = null;
    running = run().finally(() => {
      running = null;
    });
    return running;
  }

  return { syncNow, waiting: () => waiting(db) };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
