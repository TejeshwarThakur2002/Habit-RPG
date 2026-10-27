import { useEffect, useState, useSyncExternalStore } from 'react';

import { db } from '@/db/client';
import { countWaiting } from '@/db/queries/outbox';
import { getSettings } from '@/db/queries/settings';
import { getSyncState } from '@/db/queries/sync-state';
import { useDbQuery } from '@/db/use-db-query';
import { newId } from '@/lib/device';
import { syncService } from '@/sync/sync-runner';

import { syncDisplay, type SyncDisplay, type SyncMode } from './sync-display';

function readFacts() {
  const { accountUserId, demoMode } = getSettings(db);
  const mode: SyncMode = demoMode ? 'demo' : accountUserId ? 'account' : 'local';
  return { mode, waiting: countWaiting(db), lastSyncAt: getSyncState(db, newId).lastSyncAt };
}

/** The sync pill's and card's text, kept current; "5 min ago" moves on each minute. */
export function useSyncDisplay(): SyncDisplay {
  const activity = useSyncExternalStore(syncService.subscribe, syncService.activity);
  const facts = useDbQuery(readFacts);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return syncDisplay({ ...facts, activity, now });
}

/** Retry, Sync now and "Choose a hero" all sync now; a waiting choice opens again from there. */
export function syncNow(): void {
  void syncService.request('manual');
}
