import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HeroSheet } from '@/db/queries/gear';

import { HeroView, type HeroViewProps } from '../hero-view';

const sheet: HeroSheet = {
  heroName: 'Sir Commit',
  heroClass: 'knight',
  level: 7,
  gold: 128,
  stats: { STR: 8, INT: 12, CON: 18, LUCK: 6, maxHp: 57 },
  inventory: [
    { itemId: 'iron-sword', equipped: true },
    { itemId: 'leather-boots', equipped: false },
  ],
};

async function show(overrides: Partial<HeroViewProps> = {}) {
  const props = {
    sheet,
    toast: null,
    onBuy: jest.fn(),
    onEquip: jest.fn(),
    onToastDone: jest.fn(),
    ...overrides,
  };
  await render(<HeroView {...props} />);
  return props;
}

describe('HeroView', () => {
  it('shows the hero, gold and the four stats', async () => {
    await show();
    expect(screen.getByRole('header', { name: 'Your Hero' })).toBeOnTheScreen();
    expect(screen.getByText('128 gold')).toBeOnTheScreen();
    expect(screen.getByText('Level 7 Knight')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sir Commit, Level 7 Knight')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'CON 18' })).toBeOnTheScreen();
  });

  it('explains a stat when its chip is tapped', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'LUCK 6' }));
    expect(screen.getByText(/LUCK is half your longest streak/)).toBeOnTheScreen();
  });

  it('buys from the shop, with locked and too-expensive items disabled', async () => {
    const { onBuy } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Buy Oak Shield for 40 gold' }));
    expect(onBuy).toHaveBeenCalledWith('oak-shield');
    expect(screen.getByText('Unlocks at level 10')).toBeOnTheScreen();
    expect(screen.queryByText('Iron Sword')).toBeNull();
  });

  it('puts owned gear on and takes it off from the Owned tab', async () => {
    const { onEquip } = await show();
    await fireEvent.press(screen.getByRole('tab', { name: 'Owned' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Equip Leather Boots' }));
    expect(onEquip).toHaveBeenCalledWith('leather-boots', true);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Unequip Iron Sword, currently equipped' }),
    );
    expect(onEquip).toHaveBeenCalledWith('iron-sword', false);
  });

  it('offers Undo after a purchase', async () => {
    const undo = jest.fn();
    await show({ toast: { message: 'Bought Oak Shield', undo } });
    expect(screen.getByText('Bought Oak Shield')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalled();
  });
});
