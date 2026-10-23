import * as Notifications from 'expo-notifications';

import { askForNotifications, bookReminders, getNotificationAccess } from '../notifications';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  setNotificationHandler: jest.fn(),
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));

const mocked = jest.mocked(Notifications);
const permission = (status: 'granted' | 'denied' | 'undetermined') =>
  ({ status, granted: status === 'granted', canAskAgain: true, expires: 'never' }) as never;

const plan = [
  { habitId: 'water', date: '2026-10-20', at: 1_000, habitName: 'Drink water' },
  { habitId: 'water', date: '2026-10-21', at: 2_000, habitName: 'Drink water' },
];

beforeEach(() => jest.clearAllMocks());

describe('bookReminders', () => {
  it('replaces every booked reminder with the plan', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('granted'));
    await bookReminders(plan);

    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'reminder-water-2026-10-20',
        content: expect.objectContaining({ title: 'Drink water' }),
        trigger: expect.objectContaining({ type: 'date', date: 1_000 }),
      }),
    );
  });

  it('only clears reminders when notifications are off', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('denied'));
    await bookReminders(plan);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('askForNotifications', () => {
  it('asks the first time', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('undetermined'));
    mocked.requestPermissionsAsync.mockResolvedValue(permission('granted'));
    expect(await askForNotifications()).toBe('granted');
  });

  it('never asks again after a refusal', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('denied'));
    expect(await askForNotifications()).toBe('denied');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('counts provisional iOS permission as allowed', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({
      ...(permission('denied') as object),
      ios: { status: 3 },
    } as never);
    expect(await getNotificationAccess()).toBe('granted');
  });
});
