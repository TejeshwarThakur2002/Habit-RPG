import { fireEvent, render, screen } from '@testing-library/react-native';

import { LevelUpModal, levelUpReward } from '../level-up-modal';

describe('LevelUpModal', () => {
  it('celebrates the new level and closes with Continue', async () => {
    const onClose = jest.fn();
    await render(
      <LevelUpModal
        levelUp={{ level: 8, levelsGained: 1 }}
        heroClass="knight"
        equipped={[]}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('header', { name: 'Level 8!' })).toBeOnTheScreen();
    expect(screen.getByText('HP restored, +25 gold')).toBeOnTheScreen();
    expect(screen.getByLabelText('Your knight')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stays hidden until a level is gained', async () => {
    await render(
      <LevelUpModal levelUp={null} heroClass="knight" equipped={[]} onClose={jest.fn()} />,
    );
    expect(screen.queryByText(/^Level/)).toBeNull();
  });
});

describe('levelUpReward', () => {
  it('adds 25 gold for each level gained', () => {
    expect(levelUpReward(2)).toBe('HP restored, +50 gold');
  });
});
