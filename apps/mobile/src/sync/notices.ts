// What the player is told when the server refuses a change (SCOPE.md section 8.3, "roll back
// the local row and show a toast"). Notices wait in a small queue in memory and are shown one at
// a time by SyncNotices at the app root (D47). No React here, so the engine's tests can use it.

import type { Rejection } from './apply';

/** One plain sentence per refusal, saying what happened rather than the error code. */
export function rejectionMessage({ table, reason }: Rejection): string {
  if (table === 'completions') {
    if (reason === 'duplicate') return 'That quest was already done on another device.';
    if (reason === 'not_scheduled') return "That quest wasn't due that day, so it didn't count.";
    if (reason === 'date_out_of_range') {
      return "That completion was too old to sync, so it didn't count.";
    }
  }
  if (table === 'inventory') {
    if (reason === 'insufficient_gold') return 'That purchase failed: not enough gold.';
    if (reason === 'duplicate') return 'You already own that item from another device.';
  }
  return "A change couldn't be saved and was undone.";
}

type Listener = () => void;

let queue: readonly string[] = [];
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

/** Queues one notice per distinct message: three refused duplicates are one sentence. */
export function pushRejections(rejected: readonly Rejection[]): void {
  const fresh = [...new Set(rejected.map(rejectionMessage))].filter((m) => !queue.includes(m));
  if (fresh.length === 0) return;
  queue = [...queue, ...fresh];
  notify();
}

/** The notice on screen, if any. */
export function currentNotice(): string | null {
  return queue[0] ?? null;
}

export function dismissNotice(): void {
  if (queue.length === 0) return;
  queue = queue.slice(1);
  notify();
}

export function subscribeNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
