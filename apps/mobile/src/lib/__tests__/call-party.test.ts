import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { setSimulatedOffline } from '../../sync/offline-switch';
import { callParty, partyErrorMessage, watchPartyEvents } from '../supabase';

const mockInvoke = jest.fn();
interface FakeChannel {
  on: jest.Mock<FakeChannel>;
  subscribe: jest.Mock<FakeChannel>;
}
const mockChannel: FakeChannel = {
  on: jest.fn((): FakeChannel => mockChannel),
  subscribe: jest.fn((): FakeChannel => mockChannel),
};
const mockRemove = jest.fn(() => Promise.resolve('ok'));
jest.mock('@supabase/supabase-js', () => ({
  ...jest.requireActual('@supabase/supabase-js'),
  createClient: () => ({
    functions: { invoke: mockInvoke },
    channel: jest.fn(() => mockChannel),
    removeChannel: mockRemove,
    auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() },
  }),
}));

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

const refused = (error: string) => ({
  data: null,
  error: new FunctionsHttpError(new Response(JSON.stringify({ error }), { status: 409 })),
});

beforeEach(() => mockInvoke.mockReset());

describe('callParty', () => {
  it('sends the action and returns the snapshot', async () => {
    mockInvoke.mockResolvedValue({ data: { party: null }, error: null });
    expect(await callParty({ action: 'leave' })).toEqual({ ok: true, state: { party: null } });
    expect(mockInvoke).toHaveBeenCalledWith('party', { body: { action: 'leave' } });
  });

  it('turns a refusal into words the player can act on', async () => {
    mockInvoke.mockResolvedValue(refused('party_full'));
    expect(await callParty({ action: 'join', code: 'K7M2QX' })).toEqual({
      ok: false,
      message: 'That party is full: 4 members at most.',
    });
  });

  it('asks for a connection when offline, real or simulated', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new Error('offline')),
    });
    expect(await callParty({ action: 'state' })).toEqual({
      ok: false,
      message: 'You need to be online to do this.',
    });
    mockInvoke.mockReset();
    setSimulatedOffline(true);
    expect((await callParty({ action: 'state' })).ok).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
    setSimulatedOffline(false);
  });

  it('never stores an answer it does not recognise', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockInvoke.mockResolvedValue({ data: { party: { id: 'nope' } }, error: null });
    expect(await callParty({ action: 'state' })).toEqual({
      ok: false,
      message: 'Something went wrong. Try again.',
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('partyErrorMessage', () => {
  it('has a message for an unknown code', () => {
    expect(partyErrorMessage('teapot', false)).toBe('Something went wrong. Try again.');
    expect(partyErrorMessage('not_found', false)).toMatch(/No party has that code/);
  });
});

describe('watchPartyEvents', () => {
  it("hears new lines in its own party's log only, and stops when asked", () => {
    const onEvent = jest.fn();
    const stop = watchPartyEvents('p1', onEvent);
    const [kind, filter, listener] = mockChannel.on.mock.calls[0] as unknown as [
      string,
      object,
      () => void,
    ];
    expect([kind, filter]).toEqual([
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'party_events', filter: 'party_id=eq.p1' },
    ]);
    listener();
    expect(onEvent).toHaveBeenCalledTimes(1);
    stop();
    expect(mockRemove).toHaveBeenCalledWith(mockChannel);
  });
});
