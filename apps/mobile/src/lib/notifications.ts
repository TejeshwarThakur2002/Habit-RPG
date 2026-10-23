import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from '@/db/queries/reminders';

// Local quest reminders (SCOPE.md F9). Everything here is on the phone, so it works offline.
// The app books only reminders, so rebooking clears every scheduled notification first.

export type NotificationAccess = 'granted' | 'denied' | 'undetermined';

const CHANNEL_ID = 'reminders';

function toAccess(status: Notifications.NotificationPermissionsStatus): NotificationAccess {
  const provisional = status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  if (status.granted || provisional) return 'granted';
  return status.status === 'undetermined' ? 'undetermined' : 'denied';
}

/** Shows reminders that arrive while the app is open, and creates the Android channel. */
export async function setUpNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
  // Android 13+ only shows the permission prompt once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Quest reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export async function getNotificationAccess(): Promise<NotificationAccess> {
  return toAccess(await Notifications.getPermissionsAsync());
}

/** Asks only while the phone still allows it; afterwards the answer lives in phone Settings. */
export async function askForNotifications(): Promise<NotificationAccess> {
  const current = await Notifications.getPermissionsAsync();
  if (toAccess(current) !== 'undetermined') return toAccess(current);
  return toAccess(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    }),
  );
}

/** Replaces every booked reminder with `plan`. Without permission nothing is booked. */
export async function bookReminders(plan: readonly PlannedReminder[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await getNotificationAccess()) !== 'granted') return;
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${reminder.habitId}-${reminder.date}`,
      content: {
        title: reminder.habitName,
        body: 'Your quest is waiting. Finish it to earn XP and gold.',
        data: { habitId: reminder.habitId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: CHANNEL_ID,
      },
    });
  }
}
