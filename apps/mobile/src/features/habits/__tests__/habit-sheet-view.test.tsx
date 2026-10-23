import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { NEW_HABIT } from '../habit-form';
import { HabitSheetView, type HabitSheetViewProps } from '../habit-sheet-view';
import type { NotificationAccess } from '@/lib/notifications';

let access: NotificationAccess = 'granted';
beforeEach(() => {
  access = 'granted';
});

async function open(overrides: Partial<HabitSheetViewProps> = {}) {
  const props = {
    initial: NEW_HABIT,
    editing: false,
    onSave: jest.fn(),
    onArchive: jest.fn(),
    onDelete: jest.fn(),
    onCancel: jest.fn(),
    permission: {
      get: jest.fn(() => Promise.resolve(access)),
      ask: jest.fn(() => Promise.resolve(access)),
    },
    ...overrides,
  };
  await render(<HabitSheetView {...props} />);
  return props;
}

describe('HabitSheetView', () => {
  it('adds a quest with the chosen type, difficulty and category', async () => {
    const { onSave } = await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), '30 min workout');
    await fireEvent.press(screen.getByRole('tab', { name: 'Hard' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Body, trains STR' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add quest' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: '30 min workout',
        type: 'daily',
        difficulty: 'hard',
        category: 'body',
        weekdays: 127,
        reminderTime: null,
      }),
    );
  });

  it('asks for notifications when a reminder is turned on and saves its time', async () => {
    const { onSave, permission } = await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Drink water');
    await fireEvent(screen.getByLabelText('Remind me'), 'valueChange', true);
    expect(permission.ask).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^Reminder time, /)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Add quest' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reminderTime: '20:00' })),
    );
  });

  it('says when notifications are off, and keeps the reminder', async () => {
    access = 'denied';
    await open({ initial: { ...NEW_HABIT, name: 'Swim', reminderTime: '07:30' } });
    expect(await screen.findByText(/Notifications are off for Habit RPG/)).toBeOnTheScreen();
  });

  it('shows the rewards and penalty for the chosen difficulty as you pick', async () => {
    await open();
    expect(screen.getByText('+20 XP · +6 gold · −6 HP if missed')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Easy' }));
    expect(screen.getByText('+10 XP · +3 gold · −4 HP if missed')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: "Don't" }));
    expect(screen.getByText('+5 XP · +2 gold · −8 HP if broken')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Hard' })).toBeNull();
  });

  it('asks for a name before saving', async () => {
    const { onSave } = await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Add quest' }));
    expect(await screen.findByText('Give your quest a name')).toBeOnTheScreen();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('needs a day for a weekdays quest, then saves the chosen days', async () => {
    const { onSave } = await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Swim');
    await fireEvent.press(screen.getByRole('tab', { name: 'Weekdays' }));
    // All days start on; turn every one off, then pick Monday and Friday.
    for (const day of [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]) {
      await fireEvent.press(screen.getByRole('checkbox', { name: day }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Add quest' }));
    expect(await screen.findByText('Pick at least one day')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Monday' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Friday' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add quest' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'weekdays', weekdays: 17 }),
      ),
    );
  });

  it('offers archive and delete only when editing', async () => {
    const editing = await open({ editing: true, initial: { ...NEW_HABIT, name: 'Read' } });
    expect(screen.getByRole('header', { name: 'Edit quest' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Archive' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(editing.onArchive).toHaveBeenCalled();
    expect(editing.onDelete).toHaveBeenCalled();
  });

  it('hides archive and delete for a new quest, and cancels', async () => {
    const { onCancel } = await open();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
