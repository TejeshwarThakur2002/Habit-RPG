import { fireEvent, render, screen } from '@testing-library/react-native';

import type { NotificationAccess } from '@/lib/notifications';

import { NotificationsSection } from '../notifications-section';

async function show(access: NotificationAccess | null, hintSeen = false) {
  const props = {
    access,
    hintSeen,
    onTurnOn: jest.fn(),
    onOpenPhoneSettings: jest.fn(),
    onDismissHint: jest.fn(),
  };
  await render(<NotificationsSection {...props} />);
  return props;
}

const button = (name: string) => screen.getByRole('button', { name });

describe('NotificationsSection', () => {
  it('offers to turn notifications on before the phone has asked', async () => {
    const { onTurnOn } = await show('undetermined');
    expect(screen.getByText(/^Not set up yet/)).toBeOnTheScreen();
    await fireEvent.press(button('Turn on notifications'));
    expect(onTurnOn).toHaveBeenCalledTimes(1);
  });

  it('shows the one-time hint after a refusal until it is dismissed', async () => {
    const { onDismissHint, onOpenPhoneSettings } = await show('denied');
    expect(screen.getByText('Reminders need notifications')).toBeOnTheScreen();
    await fireEvent.press(button('Got it'));
    expect(onDismissHint).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('Open phone Settings'));
    expect(onOpenPhoneSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the status but not the hint once seen', async () => {
    await show('denied', true);
    expect(screen.queryByText('Reminders need notifications')).toBeNull();
    expect(screen.getByText(/^Off\. Quest reminders won't arrive/)).toBeOnTheScreen();
  });

  it('shows nothing while the phone is still being asked', async () => {
    await show(null);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
