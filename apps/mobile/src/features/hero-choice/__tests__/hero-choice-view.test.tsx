import type { AccountHero } from '@habit-rpg/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { HeroChoiceView, type HeroChoiceViewProps } from '../hero-choice-view';

const BEA: AccountHero = { hero_name: 'Bea', class: 'rogue', level: 3 };
const ADA: AccountHero = { hero_name: 'Ada', class: 'mage', level: 1 };
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

/** Presses the confirm's own button, as the player would. */
const confirm = () =>
  act(() => ((alert.mock.lastCall?.[2] ?? []) as AlertButton[])[1]?.onPress?.());

async function setup(props: Partial<HeroChoiceViewProps> = {}) {
  const shown = {
    accountHero: BEA,
    phoneHero: ADA,
    onUseAccount: jest.fn(async () => null as string | null),
    onKeepPhone: jest.fn(async () => null as string | null),
    onLater: jest.fn(),
    ...props,
  };
  await render(<HeroChoiceView {...shown} />);
  return shown;
}

const button = (name: string) => screen.getByRole('button', { name });

describe('HeroChoiceView', () => {
  it('shows both heroes with their level and class', async () => {
    await setup();
    expect(screen.getByLabelText('On your account, Bea, Level 3 Rogue')).toBeOnTheScreen();
    expect(screen.getByLabelText('On this phone, Ada, Level 1 Mage')).toBeOnTheScreen();
  });

  it("uses the account's hero only after the confirm", async () => {
    const { onUseAccount } = await setup();
    await fireEvent.press(button("Use my account's hero"));
    expect(alert).toHaveBeenLastCalledWith('Use Bea?', expect.any(String), expect.any(Array));
    expect(onUseAccount).not.toHaveBeenCalled();
    await confirm();
    expect(onUseAccount).toHaveBeenCalledTimes(1);
  });

  it("keeps this phone's hero only after the confirm", async () => {
    const { onKeepPhone } = await setup();
    await fireEvent.press(button("Keep this phone's hero"));
    expect(alert).toHaveBeenLastCalledWith('Keep Ada?', expect.any(String), expect.any(Array));
    await confirm();
    expect(onKeepPhone).toHaveBeenCalledTimes(1);
  });

  it('turns every button off while a choice runs, and says why it failed', async () => {
    let finish: (error: string | null) => void = () => undefined;
    const onKeepPhone = jest.fn(() => new Promise<string | null>((done) => (finish = done)));
    await setup({ onKeepPhone });
    await fireEvent.press(button("Keep this phone's hero"));
    await confirm();
    expect(screen.getByText('Syncing…')).toBeOnTheScreen();
    expect(button('Not now')).toBeDisabled();
    expect(button("Use my account's hero")).toBeDisabled();

    await act(() => finish("Can't reach the server. Try again when you're online."));
    expect(screen.getByRole('alert')).toHaveTextContent(/Can't reach the server/);
    expect(button("Keep this phone's hero")).toBeEnabled();
  });

  it('can be put off with "Not now"', async () => {
    const { onLater, onUseAccount, onKeepPhone } = await setup();
    await fireEvent.press(button('Not now'));
    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onUseAccount).not.toHaveBeenCalled();
    expect(onKeepPhone).not.toHaveBeenCalled();
  });

  it("still offers both choices when the account's hero isn't known", async () => {
    await setup({ accountHero: null });
    expect(screen.getByLabelText('On your account, a hero')).toBeOnTheScreen();
    await fireEvent.press(button("Use my account's hero"));
    expect(alert).toHaveBeenLastCalledWith(
      "Use your account's hero?",
      expect.any(String),
      expect.any(Array),
    );
  });
});
