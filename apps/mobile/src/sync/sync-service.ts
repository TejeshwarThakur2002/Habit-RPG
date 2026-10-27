// When the phone syncs, and what it last saw (SCOPE.md section 8.3, F8; D51). Every sync goes
// through one service, one at a time: the app's triggers (start, foreground, reconnect, 2 s
// after a local change, Sync now), the engine's own retries, and the first sync and hero choice
// (D48 to D50). No React here; the app's hook calls it and its tests drive it with a fake
// server and fake timers.

import { getSettings } from '../db/queries/settings';
import { createSyncEngine, type SyncEngineOptions, type SyncOutcome } from './engine';
import {
  needsFirstSync,
  runFirstSync,
  takeAccountHero,
  type FirstSyncChoice,
  type FirstSyncOutcome,
} from './first-sync';
import { askHeroChoice } from './hero-choice';
import { pushNotice, pushRejections } from './notices';

export type SyncTrigger = 'start' | 'foreground' | 'reconnect' | 'write' | 'manual' | 'retry';

/** What the last sync did; the pill and the Stats card show it (D2). */
export interface SyncActivity {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  message: string | null;
}

export type SyncServiceOptions = Required<Pick<SyncEngineOptions, 'setTimer' | 'clearTimer'>> &
  SyncEngineOptions;

/** Changes are sent this long after the last one, so a burst of taps goes in one request. */
export const WRITE_DELAY_MS = 2000;

/** The activity's message while the two-heroes choice waits for the player (D50). */
export const HERO_CHOICE_PENDING = 'Choose which hero to keep';

export const HERO_REPLACED_NOTICE =
  "Your account's hero was replaced from another phone, so this phone now has it too.";

/**
 * A pending first sync runs only at start and on Sync now: after "Not now", the hero choice
 * isn't asked again every time the app comes back (D51).
 */
const mayRunFirstSync = (trigger: SyncTrigger) => trigger === 'start' || trigger === 'manual';

export function createSyncService(o: SyncServiceOptions) {
  // The engine's retries come back here as triggers, so they show in the activity too.
  const engine = createSyncEngine({ ...o, setTimer: (_run, ms) => o.setTimer(retry, ms) });
  let activity: SyncActivity = { state: 'idle', message: null };
  const listeners = new Set<() => void>();
  let tail: Promise<unknown> = Promise.resolve();
  let queued: SyncTrigger | null = null;
  let writeTimer: unknown = null;

  function publish(next: SyncActivity): void {
    activity = next;
    listeners.forEach((listener) => listener());
  }

  /** Runs after everything already queued, so two syncs never overlap. */
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task);
    tail = next.catch((error: unknown) => {
      console.error('sync failed', error);
      publish({ state: 'error', message: 'Sync stopped unexpectedly' });
    });
    return next;
  }

  async function settleFirst(accountUserId: string, outcome: FirstSyncOutcome) {
    if (outcome.status === 'done') {
      pushRejections(outcome.rejected);
      publish({ state: 'idle', message: null });
    } else if (outcome.status === 'conflict') {
      askHeroChoice({ accountUserId, accountHero: outcome.accountHero });
      publish({ state: 'error', message: HERO_CHOICE_PENDING });
    } else {
      publish({ state: outcome.status, message: outcome.message });
    }
    return outcome;
  }

  async function settle(accountUserId: string, outcome: SyncOutcome): Promise<void> {
    pushRejections(outcome.rejected);
    if (outcome.status === 'synced') return publish({ state: 'idle', message: null });
    if (outcome.status === 'error' && outcome.code === 'hero_replaced') {
      const back = await takeAccountHero(o, accountUserId);
      if (back.status === 'done') pushNotice(HERO_REPLACED_NOTICE);
      await settleFirst(accountUserId, back);
      return;
    }
    publish({ state: outcome.status, message: outcome.message });
  }

  async function run(trigger: SyncTrigger): Promise<void> {
    const { accountUserId, demoMode } = getSettings(o.db);
    // The demo and a hero kept only on this phone never sync (D45).
    if (accountUserId === null || demoMode) return publish({ state: 'idle', message: null });
    if (needsFirstSync(o.db, o.newId)) {
      if (!mayRunFirstSync(trigger)) return;
      publish({ state: 'syncing', message: null });
      await settleFirst(accountUserId, await runFirstSync(o, accountUserId));
      return;
    }
    publish({ state: 'syncing', message: null });
    await settle(accountUserId, await engine.syncNow());
  }

  /** Syncs soon. Triggers that arrive while one is waiting share it. */
  function request(trigger: SyncTrigger): Promise<unknown> {
    if (queued !== null) {
      if (mayRunFirstSync(trigger)) queued = trigger;
      return tail;
    }
    queued = trigger;
    return exclusive(() => {
      const next = queued ?? trigger;
      queued = null;
      return run(next);
    });
  }

  function retry(): void {
    void request('retry');
  }

  /**
   * The outbox changed: sync once the changes stop for WRITE_DELAY_MS, if any change hasn't been
   * tried yet. A failed attempt updates the outbox too; its retry is the engine's backoff, not
   * another sync 2 s later.
   */
  function afterWrite(): void {
    if (writeTimer !== null) o.clearTimer(writeTimer);
    writeTimer = o.setTimer(() => {
      writeTimer = null;
      if (engine.untried() > 0) void request('write');
    }, WRITE_DELAY_MS);
  }

  return {
    request,
    afterWrite,
    /** The first sync for an account, from sign-in, linking, onboarding or the hero choice. */
    firstSync: (accountUserId: string, choice: FirstSyncChoice = {}) =>
      exclusive(async () => {
        publish({ state: 'syncing', message: null });
        return settleFirst(accountUserId, await runFirstSync(o, accountUserId, choice));
      }),
    /** "Use my account's hero" (D50). */
    takeAccountHero: (accountUserId: string) =>
      exclusive(async () => {
        publish({ state: 'syncing', message: null });
        return settleFirst(accountUserId, await takeAccountHero(o, accountUserId));
      }),
    activity: () => activity,
    /** Resolves once everything queued so far has run. */
    settled: () => tail,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
