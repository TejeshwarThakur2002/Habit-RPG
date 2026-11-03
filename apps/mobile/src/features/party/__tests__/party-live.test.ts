import { saveParty } from '@/db/queries/party';
import { createTestDb } from '@/test/test-db';

import { LIVE_REFRESH_DELAY_MS, refreshAfterSync, startLiveParty } from '../party-live';

function fakes() {
  let onEvent = () => {};
  const timers = new Set<{ run: () => void; ms: number }>();
  const unwatch = jest.fn();
  const o = {
    unwatch,
    refresh: jest.fn(),
    watch: jest.fn((_id: string, listener: () => void) => {
      onEvent = listener;
      return unwatch;
    }),
    setTimer: (run: () => void, ms: number) => {
      const timer = { run, ms };
      timers.add(timer);
      return timer;
    },
    clearTimer: (handle: unknown) => timers.delete(handle as { run: () => void; ms: number }),
  };
  const fireTimers = () => [...timers].forEach((t) => (timers.delete(t), t.run()));
  return { o, event: () => onEvent(), timers, fireTimers };
}

describe('startLiveParty', () => {
  it('watches its party and refreshes once for a burst of lines', () => {
    const { o, event, timers, fireTimers } = fakes();
    startLiveParty('p', o);
    expect(o.watch).toHaveBeenCalledWith('p', expect.any(Function));
    event();
    event();
    event();
    expect(timers.size).toBe(1);
    expect([...timers][0]?.ms).toBe(LIVE_REFRESH_DELAY_MS);
    expect(o.refresh).not.toHaveBeenCalled();
    fireTimers();
    expect(o.refresh).toHaveBeenCalledTimes(1);
  });

  it('stops watching, and drops a refresh still waiting, when the tab closes', () => {
    const { o, event, timers } = fakes();
    const stop = startLiveParty('p', o);
    event();
    stop();
    expect(o.unwatch).toHaveBeenCalled();
    expect(timers.size).toBe(0);
  });
});

describe('refreshAfterSync', () => {
  it('refreshes only while the player is in a party', async () => {
    const db = await createTestDb();
    const refresh = jest.fn();
    refreshAfterSync(db, refresh);
    expect(refresh).not.toHaveBeenCalled();
    const party = {
      id: '00000000-0000-4000-8000-0000000000f1',
      name: 'Owls',
      code: 'K7M2QX',
      timezone: 'UTC',
      members: [],
      boss: null,
      events: [],
      claimed: false,
    };
    saveParty(db, { party }, 'me', Date.now());
    refreshAfterSync(db, refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
