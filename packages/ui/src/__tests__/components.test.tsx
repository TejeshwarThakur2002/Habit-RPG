import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../components/button';
import { Chip, ScreenHeader, StatChip } from '../components/small';
import { StatBar } from '../components/stat-bar';
import { SyncPill, syncPillText } from '../components/sync-pill';
import { ReduceMotionProvider } from '../motion';

describe('Button', () => {
  it('is a labelled button that fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Buy" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Buy' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the disabled state and ignores presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Buy" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Buy' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders every variant', async () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      await render(<Button label={variant} variant={variant} />);
      expect(screen.getByRole('button', { name: variant })).toBeOnTheScreen();
    }
  });
});

describe('StatBar', () => {
  it('always shows the numbers and exposes them to screen readers', async () => {
    await render(<StatBar label="HP" value={42} max={50} color="red" />);
    expect(screen.getByText('42 / 50')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'HP' })).toHaveAccessibilityValue({
      text: '42 of 50',
    });
  });

  it('copes with a zero max and reduced motion', async () => {
    await render(
      <ReduceMotionProvider value="on">
        <StatBar label="XP" value={5} max={0} color="teal" />
      </ReduceMotionProvider>,
    );
    expect(screen.getByText('5 / 0')).toBeOnTheScreen();
  });
});

describe('SyncPill', () => {
  it('writes every state out in words', () => {
    expect(syncPillText('synced')).toBe('Synced · works offline');
    expect(syncPillText('syncing')).toBe('Syncing...');
    expect(syncPillText('offline', 3)).toBe('Offline · 3 waiting');
    expect(syncPillText('error')).toBe('Sync failed');
  });

  it('opens the sync details when tapped', async () => {
    const onPress = jest.fn();
    await render(<SyncPill status="offline" waiting={2} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Offline · 2 waiting' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('small components', () => {
  it('renders a chip, a header and stat chips', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <ScreenHeader title="Your Hero" right={<Chip color="gold" label="128 gold" />} />
        <StatChip label="STR" value={14} />
        <StatChip label="INT" value={19} onPress={onPress} />
      </>,
    );
    expect(screen.getByRole('header', { name: 'Your Hero' })).toBeOnTheScreen();
    expect(screen.getByText('128 gold')).toBeOnTheScreen();
    expect(screen.getByLabelText('STR 14')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'INT 19' }));
    expect(onPress).toHaveBeenCalled();
  });
});
