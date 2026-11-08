// Keeping the Party tab current (D63): live battle-log lines while it's open, and a quiet
// refresh after each sync while the player is in a party. No React here.

import { getPartyView } from '@/db/queries/party';
import type { AppDb } from '@/db/types';

/** One transaction can add several lines (a hit and the victory), so they share a refresh. */
export const LIVE_REFRESH_DELAY_MS = 300;

export interface LiveOptions {
  watch: (partyId: string, onEvent: () => void) => () => void;
  refresh: () => void;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

/** Watches the party's battle log and refreshes once per burst; returns the stop. */
export function startLiveParty(partyId: string, o: LiveOptions): () => void {
  let timer: unknown = null;
  const stopWatching = o.watch(partyId, () => {
    if (timer !== null) o.clearTimer(timer);
    timer = o.setTimer(() => {
      timer = null;
      o.refresh();
    }, LIVE_REFRESH_DELAY_MS);
  });
  return () => {
    if (timer !== null) o.clearTimer(timer);
    stopWatching();
  };
}

/** After a sync: the player's own hits are now on the server, so a stored party is behind. */
export function refreshAfterSync(db: AppDb, refresh: () => void): void {
  if (getPartyView(db, Date.now()) !== null) refresh();
}
