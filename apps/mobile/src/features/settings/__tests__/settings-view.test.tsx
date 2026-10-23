import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsView, type AccountMode } from '../settings-view';

async function setup(mode: AccountMode = 'local', deviceTimeZone = 'America/Toronto') {
  const props = {
    hero: { heroName: 'Sir Commit', timezone: 'America/Toronto' },
    deviceTimeZone,
    reduceMotion: 'system' as const,
    mode,
    version: '0.0.1',
    onSaveHero: jest.fn(),
    onReduceMotion: jest.fn(),
    onSignOut: jest.fn(),
    onClose: jest.fn(),
  };
  await render(<SettingsView {...props} />);
  return props;
}

const button = (name: string) => screen.getByRole('button', { name });

describe('SettingsView', () => {
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

  it('warns a local hero that signing out deletes them', async () => {
    const { onSignOut } = await setup('local');
    expect(screen.getByText(/Signing out deletes it/)).toBeOnTheScreen();
    await fireEvent.press(button('Sign out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('lets the demo be left', async () => {
    const { onSignOut } = await setup('demo');
    await fireEvent.press(button('Leave the demo'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows the version and closes with Done', async () => {
    const { onClose } = await setup();
    expect(screen.getByText('Habit RPG version 0.0.1')).toBeOnTheScreen();
    await fireEvent.press(button('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
