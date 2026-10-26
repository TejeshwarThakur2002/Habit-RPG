// The two-heroes choice waiting for the player (D48, D49): set when the first sync finds that
// the account already has a different hero, and shown by HeroChoice at the app root. It lives
// in memory only: "Not now" or a restart drops it, and the next first sync asks again. No React
// here, so the sync code's tests can use it.

import type { AccountHero } from '@habit-rpg/shared';

export interface PendingHeroChoice {
  accountUserId: string;
  /** Null when the server didn't say which hero the account has. */
  accountHero: AccountHero | null;
}

let pending: PendingHeroChoice | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function askHeroChoice(choice: PendingHeroChoice): void {
  pending = choice;
  notify();
}

export function currentHeroChoice(): PendingHeroChoice | null {
  return pending;
}

export function closeHeroChoice(): void {
  if (pending === null) return;
  pending = null;
  notify();
}

export function subscribeHeroChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
