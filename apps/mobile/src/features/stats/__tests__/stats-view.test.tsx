import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Stats } from '@/db/queries/stats';
import { colors } from '@habit-rpg/ui';

import { rateColor } from '../quest-rates';
import { StatsView } from '../stats-view';

const stats: Stats = {
  streak: 12,
  monthPercent: 86,
  bossesBeaten: 3,
  heatmap: Array.from({ length: 84 }, (_, i) => i % 3),
  heatmapSummary: '8 of the last 12 weeks had 5 or more active days',
  habitRates: [
    { habitId: 'water', name: 'Drink water', percent: 93, streak: 12 },
    { habitId: 'swim', name: 'Swim', percent: null, streak: 0 },
  ],
};

async function show(demo = false) {
  const props = { stats, demo, onEditHabit: jest.fn(), onReset: jest.fn() };
  await render(<StatsView {...props} />);
  return props;
}

describe('StatsView', () => {
  it('shows the three tiles, the heatmap and the sync card', async () => {
    await show();
    expect(screen.getByRole('header', { name: 'Adventure Log' })).toBeOnTheScreen();
    expect(screen.getByLabelText('12 day streak')).toBeOnTheScreen();
    expect(screen.getByLabelText('86% this month')).toBeOnTheScreen();
    expect(screen.getByLabelText('3 bosses beaten')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: stats.heatmapSummary })).toBeOnTheScreen();
    expect(screen.getByText('Saved on this phone')).toBeOnTheScreen();
    expect(screen.getByText(/Your progress will sync once you sign in/)).toBeOnTheScreen();
  });

  it('says demo data never syncs', async () => {
    await show(true);
    expect(
      screen.getByText('Demo data stays on this phone and is never synced.'),
    ).toBeOnTheScreen();
  });

  it("opens a quest's streak and links to editing it", async () => {
    const { onEditHabit } = await show();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Drink water, 93% in the last 30 days' }),
    );
    expect(screen.getByText('Current streak: 12 days')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit quest' }));
    expect(onEditHabit).toHaveBeenCalledWith('water');
  });

  it('shows a dash for a quest with nothing scheduled yet', async () => {
    await show();
    expect(screen.getByRole('button', { name: 'Swim, – in the last 30 days' })).toBeOnTheScreen();
  });
});

describe('rateColor', () => {
  it('is teal from 70% and gold below', () => {
    expect(rateColor(70)).toBe(colors.teal);
    expect(rateColor(69)).toBe(colors.gold);
    expect(rateColor(null)).toBe(colors.gold);
  });
});
