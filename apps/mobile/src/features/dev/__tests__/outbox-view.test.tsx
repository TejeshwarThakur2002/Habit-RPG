import { fireEvent, render, screen } from '@testing-library/react-native';

import { OutboxView, type OutboxViewProps } from '../outbox-view';

async function show(over: Partial<OutboxViewProps> = {}) {
  const props: OutboxViewProps = {
    rows: [
      {
        id: 7,
        tableName: 'completions',
        op: 'upsert',
        rowId: 'abcdef123456',
        attempts: 2,
        lastError: "Can't reach the server",
      },
    ],
    sync: { cursor: 42, deviceId: '7c9e6679-7425', account: 'ada@example.com', lastSyncAt: null },
    activity: { state: 'offline', message: "Can't reach the server" },
    offline: false,
    onForceSync: jest.fn(),
    onToggleOffline: jest.fn(),
    onClose: jest.fn(),
    ...over,
  };
  await render(<OutboxView {...props} />);
  return props;
}

describe('OutboxView', () => {
  it('lists what waits, with its tries and last error, and the sync state', async () => {
    await show();
    expect(screen.getByRole('header', { name: '1 change waiting' })).toBeOnTheScreen();
    expect(screen.getByText('#7 completions upsert abcdef12')).toBeOnTheScreen();
    expect(screen.getByText("Tried 2 times · Can't reach the server")).toBeOnTheScreen();
    expect(screen.getByText("Sync: offline: Can't reach the server")).toBeOnTheScreen();
    expect(screen.getByText('Cursor: 42')).toBeOnTheScreen();
  });

  it('forces a sync and switches simulated offline', async () => {
    const { onForceSync, onToggleOffline } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Force sync' }));
    expect(onForceSync).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText('Simulate offline'), 'valueChange', true);
    expect(onToggleOffline).toHaveBeenCalledWith(true);
  });
});
