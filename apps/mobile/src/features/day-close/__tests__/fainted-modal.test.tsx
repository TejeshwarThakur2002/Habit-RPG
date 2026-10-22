import { fireEvent, render, screen } from '@testing-library/react-native';

import { FaintedModal, faintMessage } from '../fainted-modal';

const notice = {
  date: '2026-10-20',
  goldLost: 12,
  xpLost: 40,
  missed: ['Code for 1 hour', 'No doomscrolling'],
};

describe('FaintedModal', () => {
  it('says what was lost and missed, and closes with Continue', async () => {
    const onClose = jest.fn();
    await render(<FaintedModal notice={notice} onClose={onClose} />);

    expect(screen.getByRole('header', { name: 'You fainted!' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'You lost 12 gold and your progress to the next level. Rest up and try again.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Missed: Code for 1 hour, No doomscrolling')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stays hidden with no faint to show', async () => {
    await render(<FaintedModal notice={null} onClose={jest.fn()} />);
    expect(screen.queryByText('You fainted!')).toBeNull();
  });
});

describe('faintMessage', () => {
  it('leaves out XP when there was none to lose', () => {
    expect(faintMessage({ ...notice, goldLost: 1, xpLost: 0 })).toBe(
      'You lost 1 gold. Rest up and try again.',
    );
  });
});
