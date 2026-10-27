import { HERO_CHOICE_PENDING } from '@/sync/sync-service';

import { sinceText, syncDisplay, type SyncFacts } from '../sync-display';

const NOW = Date.parse('2026-10-27T12:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const facts = (over: Partial<SyncFacts> = {}): SyncFacts => ({
  mode: 'account',
  activity: { state: 'idle', message: null },
  waiting: 0,
  lastSyncAt: ago(5),
  now: NOW,
  ...over,
});

describe('syncDisplay', () => {
  it('keeps the demo and a hero without an account on this phone', () => {
    expect(syncDisplay(facts({ mode: 'demo' }))).toMatchObject({ pill: 'local', action: null });
    expect(syncDisplay(facts({ mode: 'local' })).detail).toMatch(/sync once you sign in/);
  });

  it('says all synced, with when, and offers Sync now', () => {
    expect(syncDisplay(facts())).toEqual({
      pill: 'synced',
      title: 'All synced',
      detail: 'Last synced 5 min ago.',
      action: 'Sync now',
    });
    expect(syncDisplay(facts({ lastSyncAt: null })).detail).toBe('Not synced yet.');
  });

  it('counts what waits offline, and offers Retry', () => {
    const offline = { state: 'offline', message: "Can't reach the server" } as const;
    expect(syncDisplay(facts({ activity: offline, waiting: 3 }))).toMatchObject({
      pill: 'offline',
      title: 'Offline · 3 changes waiting',
      action: 'Retry',
    });
    expect(syncDisplay(facts({ activity: offline, waiting: 1 })).title).toBe(
      'Offline · 1 change waiting',
    );
  });

  it('says why a sync failed, and that nothing was lost', () => {
    const failed = { state: 'error', message: 'The server had a problem' } as const;
    expect(syncDisplay(facts({ activity: failed }))).toMatchObject({
      pill: 'error',
      title: 'Sync failed',
      detail: 'The server had a problem. Your changes are safe on this phone.',
      action: 'Retry',
    });
  });

  it('shows changes about to go as syncing, and a waiting hero choice as its own state', () => {
    expect(syncDisplay(facts({ waiting: 2 }))).toMatchObject({
      pill: 'syncing',
      title: '2 changes waiting',
    });
    const choice = { state: 'error', message: HERO_CHOICE_PENDING } as const;
    expect(syncDisplay(facts({ activity: choice }))).toMatchObject({
      pill: 'error',
      title: 'Your account already has another hero',
      action: 'Choose a hero',
    });
  });
});

describe('sinceText', () => {
  it('says how long ago, without a locale or time zone', () => {
    expect(
      [0, 1, 59, 60, 23 * 60 + 59, 24 * 60, 3 * 24 * 60].map((m) => sinceText(ago(m), NOW)),
    ).toEqual([
      'just now',
      '1 min ago',
      '59 min ago',
      '1 h ago',
      '23 h ago',
      '1 day ago',
      '3 days ago',
    ]);
  });
});
