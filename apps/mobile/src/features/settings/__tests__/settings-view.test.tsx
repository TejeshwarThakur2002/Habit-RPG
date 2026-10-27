import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsView, type AccountMode } from '../settings-view';

async function setup(mode: AccountMode = 'local', deviceTimeZone = 'America/Toronto') {
  const props = {
    hero: { heroName: 'Sir Commit', timezone: 'America/Toronto' },
    heroKey: '2026-10-20T12:00:00.000Z',
    deviceTimeZone,
    reduceMotion: 'system' as const,
    mode,
    email: mode === 'account' ? 'ada@example.com' : null,
    version: '0.0.1',
    notifications: {
      access: 'granted' as const,
      hintSeen: false,
      onTurnOn: jest.fn(),
      onOpenPhoneSettings: jest.fn(),
      onDismissHint: jest.fn(),
    },
    onSaveHero: jest.fn(),
    onReduceMotion: jest.fn(),
    onSignOut: jest.fn(),
    onLinkAccount: jest.fn(),
    onDeleteAccount: jest.fn(),
    onClose: jest.fn(),
  };
  const view = await render(<SettingsView {...props} />);
  return { ...props, rerender: view.rerender };
}

const button = (name: string) => screen.getByRole('button', { name });

describe('SettingsView', () => {
  it('offers the sync outbox only when a developer screen is passed in', async () => {
    const { rerender, ...props } = await setup('account');
    expect(screen.queryByRole('button', { name: 'Sync outbox' })).toBeNull();
    const onOpenDeveloper = jest.fn();
    await rerender(<SettingsView {...props} onOpenDeveloper={onOpenDeveloper} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sync outbox' }));
    expect(onOpenDeveloper).toHaveBeenCalledTimes(1);
  });

  it('starts the hero form again when another hero takes over the phone', async () => {
    const { rerender, ...props } = await setup('account');
    await fireEvent.changeText(screen.getByLabelText('Hero name'), 'Half typed');
    await rerender(
      <SettingsView
        {...props}
        hero={{ heroName: 'Ada', timezone: 'America/Toronto' }}
        heroKey="2026-10-26T20:47:55.788Z"
      />,
    );
    expect(screen.getByLabelText('Hero name')).toHaveDisplayValue('Ada');
    expect(button('Save changes')).toBeDisabled();
  });

  it('saves a cleaned hero name only once something changed', async () => {
    const { onSaveHero } = await setup();
    expect(screen.getByLabelText('Hero name')).toHaveDisplayValue('Sir Commit');
    expect(button('Save changes')).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Hero name'), '  Lady   Merge ');
    await fireEvent.press(button('Save changes'));
    expect(onSaveHero).toHaveBeenCalledWith({
      heroName: 'Lady Merge',
      timezone: 'America/Toronto',
    });
    expect(screen.getByText('Saved')).toBeOnTheScreen();
  });

  it('refuses a name that is too short or a zone that does not exist', async () => {
    const { onSaveHero } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Hero name'), 'A');
    expect(screen.getByText('Use at least 2 characters')).toBeOnTheScreen();
    expect(button('Save changes')).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Hero name'), 'Ada');
    await fireEvent.changeText(screen.getByLabelText('Time zone'), 'Mars/Olympus');
    expect(screen.getByText('Enter a time zone like America/Toronto')).toBeOnTheScreen();
    expect(button('Save changes')).toBeDisabled();
    expect(onSaveHero).not.toHaveBeenCalled();
  });

  it("offers the phone's zone when the hero's is different", async () => {
    const { onSaveHero } = await setup('local', 'Europe/London');
    await fireEvent.press(button("Use this phone's zone (Europe/London)"));
    expect(screen.getByLabelText('Time zone')).toHaveDisplayValue('Europe/London');
    await fireEvent.press(button('Save changes'));
    expect(onSaveHero).toHaveBeenCalledWith({
      heroName: 'Sir Commit',
      timezone: 'Europe/London',
    });
  });

  it('hides that offer when the zones match', async () => {
    await setup();
    expect(screen.queryByRole('button', { name: /Use this phone's zone/ })).toBeNull();
  });

  it('switches the Reduce Motion override', async () => {
    const { onReduceMotion } = await setup();
    expect(screen.getByRole('tab', { name: 'System' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'On' }));
    expect(onReduceMotion).toHaveBeenCalledWith('on');
  });

  it('offers a local hero a way to keep their progress, or to sign out and delete it', async () => {
    const { onSignOut, onLinkAccount } = await setup('local');
    expect(
      screen.getByText(/Link an account to keep it, or sign out to delete it/),
    ).toBeOnTheScreen();
    await fireEvent.press(button('Link an account'));
    expect(onLinkAccount).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('Sign out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('offers to delete the account only when signed in', async () => {
    const { onDeleteAccount } = await setup('account');
    await fireEvent.press(button('Delete account'));
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it.each(['local', 'demo'] as const)('has no account to delete in %s mode', async (mode) => {
    await setup(mode);
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull();
  });

  it('shows the signed-in email and that the hero syncs to it', async () => {
    const { onSignOut } = await setup('account');
    expect(screen.queryByRole('button', { name: 'Link an account' })).toBeNull();
    expect(screen.getByText(/Signed in as ada@example.com/)).toBeOnTheScreen();
    expect(screen.getByText(/syncs to your account whenever you're online/)).toBeOnTheScreen();
    await fireEvent.press(button('Sign out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('lets the demo be left', async () => {
    const { onSignOut } = await setup('demo');
    await fireEvent.press(button('Leave the demo'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows that notifications are on', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Notifications' })).toBeOnTheScreen();
    expect(screen.getByText(/^On\. Quest reminders arrive/)).toBeOnTheScreen();
  });

  it('shows the version and closes with Done', async () => {
    const { onClose } = await setup();
    expect(screen.getByText('Habit RPG version 0.0.1')).toBeOnTheScreen();
    await fireEvent.press(button('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
