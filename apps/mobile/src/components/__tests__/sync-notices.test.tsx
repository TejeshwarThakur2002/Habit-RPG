import { act, render, screen } from '@testing-library/react-native';

import { currentNotice, dismissNotice, pushRejections } from '@/sync/notices';

import { SyncNotices } from '../sync-notices';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  while (currentNotice() !== null) dismissNotice();
});

describe('SyncNotices', () => {
  it('shows nothing without a notice', async () => {
    await render(<SyncNotices />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows one notice at a time, each for 5 seconds', async () => {
    await render(<SyncNotices />);
    await act(() =>
      pushRejections([
        { id: ID, table: 'inventory', reason: 'insufficient_gold' },
        { id: ID, table: 'completions', reason: 'duplicate' },
      ]),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('That purchase failed: not enough gold.');
    await act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByRole('alert')).toHaveTextContent(/already done on another device/);
    await act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
