import type { SyncStatus } from '@habit-rpg/ui';

import { HERO_CHOICE_PENDING, type SyncActivity } from '@/sync/sync-service';

export type SyncMode = 'demo' | 'local' | 'account';

export interface SyncFacts {
  mode: SyncMode;
  activity: SyncActivity;
  /** Outbox rows not yet settled by the server. */
  waiting: number;
  lastSyncAt: string | null;
  now: number;
}

export interface SyncDisplay {
  pill: SyncStatus;
  title: string;
  detail: string;
  /** The Stats card's button; every one of them runs Sync now. */
  action: 'Retry' | 'Sync now' | 'Choose a hero' | null;
}

const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

/** "just now", "5 min ago", "2 h ago", "3 days ago": no locale or time zone needed. */
export function sinceText(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** What the sync pill and the Stats sync card say (SCOPE.md sections 5.2 and 5.7, D52). */
export function syncDisplay({ mode, activity, waiting, lastSyncAt, now }: SyncFacts): SyncDisplay {
  if (mode !== 'account') {
    const detail =
      mode === 'demo'
        ? 'Demo data stays on this phone and is never synced.'
        : 'Playing without an account. Your progress will sync once you sign in.';
    return { pill: 'local', title: 'Saved on this phone', detail, action: null };
  }
  if (activity.message === HERO_CHOICE_PENDING) {
    return {
      pill: 'error',
      title: 'Your account already has another hero',
      detail: 'Choose which one to keep before this phone can sync.',
      action: 'Choose a hero',
    };
  }
  switch (activity.state) {
    case 'syncing':
      return {
        pill: 'syncing',
        title: 'Syncing...',
        detail: 'Talking to the server.',
        action: null,
      };
    case 'offline':
      return {
        pill: 'offline',
        title: `Offline · ${changes(waiting)} waiting`,
        detail: "Saved on your phone. Syncs when you're back online.",
        action: 'Retry',
      };
    case 'error':
      return {
        pill: 'error',
        title: 'Sync failed',
        detail: `${activity.message ?? 'Something went wrong'}. Your changes are safe on this phone.`,
        action: 'Retry',
      };
    case 'idle':
      if (waiting > 0) {
        return {
          pill: 'syncing',
          title: `${changes(waiting)} waiting`,
          detail: 'Saved on your phone. They sync in a moment.',
          action: 'Sync now',
        };
      }
      return {
        pill: 'synced',
        title: 'All synced',
        detail: lastSyncAt ? `Last synced ${sinceText(lastSyncAt, now)}.` : 'Not synced yet.',
        action: 'Sync now',
      };
  }
}
