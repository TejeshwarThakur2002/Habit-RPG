import {
  currentNotice,
  dismissNotice,
  pushRejections,
  rejectionMessage,
  subscribeNotices,
} from '../notices';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

afterEach(() => {
  while (currentNotice() !== null) dismissNotice();
});

describe('rejectionMessage', () => {
  it('says what happened for each refusal the player can meet', () => {
    const say = (table: string, reason: Parameters<typeof rejectionMessage>[0]['reason']) =>
      rejectionMessage({ id: ID, table, reason });
    expect(say('inventory', 'insufficient_gold')).toBe('That purchase failed: not enough gold.');
    expect(say('inventory', 'duplicate')).toMatch(/already own that item/);
    expect(say('completions', 'duplicate')).toMatch(/already done on another device/);
    expect(say('completions', 'not_scheduled')).toMatch(/wasn't due that day/);
    expect(say('completions', 'date_out_of_range')).toMatch(/too old to sync/);
    expect(say('habits', 'invalid')).toBe("A change couldn't be saved and was undone.");
  });
});

describe('the notice queue', () => {
  it('shows one notice per distinct message, in order, and tells listeners', () => {
    const listener = jest.fn();
    const stop = subscribeNotices(listener);
    pushRejections([
      { id: ID, table: 'completions', reason: 'duplicate' },
      { id: ID, table: 'completions', reason: 'duplicate' },
      { id: ID, table: 'inventory', reason: 'insufficient_gold' },
    ]);
    expect(currentNotice()).toMatch(/already done on another device/);
    dismissNotice();
    expect(currentNotice()).toBe('That purchase failed: not enough gold.');
    dismissNotice();
    expect(currentNotice()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });
});
