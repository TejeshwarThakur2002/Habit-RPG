import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Button, colors, type } from '@habit-rpg/ui';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import type { NotificationAccess } from '@/lib/notifications';

/** A new reminder starts in the evening, when most quests are still open. */
export const DEFAULT_REMINDER = '20:00';

export interface NotificationPermission {
  get: () => Promise<NotificationAccess>;
  /** Shows the phone's prompt the first time; later it just reports the answer. */
  ask: () => Promise<NotificationAccess>;
}

export interface ReminderPickerProps {
  /** 'HH:MM', or null for no reminder. */
  value: string | null;
  onChange: (value: string | null) => void;
  permission: NotificationPermission;
}

/** SCOPE.md section 5.8: the habit sheet's reminder toggle and time picker (F9). */
export function ReminderPicker({ value, onChange, permission }: ReminderPickerProps) {
  const [blocked, setBlocked] = useState(false);
  const on = value !== null;

  // An existing reminder whose notifications were turned off later still says so.
  useEffect(() => {
    if (!on) return;
    permission
      .get()
      .then((access) => setBlocked(access === 'denied'))
      .catch((error: unknown) => console.warn('Reading notification permission failed', error));
  }, [on, permission]);

  const toggle = (next: boolean) => {
    if (!next) {
      onChange(null);
      return;
    }
    onChange(DEFAULT_REMINDER);
    // The prompt comes when the player first asks for a reminder, not when the app opens.
    permission
      .ask()
      .then((access) => setBlocked(access !== 'granted'))
      .catch((error: unknown) => console.warn('Asking for notifications failed', error));
  };

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={type.body}>Remind me</Text>
        <Switch
          accessibilityLabel="Remind me"
          value={on}
          onValueChange={toggle}
          trackColor={{ true: colors.gold, false: colors.borderStrong }}
        />
      </View>
      {value !== null && <TimeField value={value} onChange={onChange} />}
      {on && blocked && (
        <Text accessibilityLiveRegion="polite" style={type.secondary}>
          Notifications are off for Habit RPG, so this reminder won&apos;t arrive. You can turn them
          on in your phone&apos;s Settings.
        </Text>
      )}
    </View>
  );
}

function toDate(time: string): Date {
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function toTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** '20:00' as the phone shows times, e.g. "8:00 PM". */
export function formatTime(time: string): string {
  return toDate(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pick = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) onChange(toTime(date));
  };
  const label = `Reminder time, ${formatTime(value)}`;
  if (Platform.OS === 'android') {
    const open = () =>
      DateTimePickerAndroid.open({ value: toDate(value), mode: 'time', onChange: pick });
    return <Button label={label} variant="secondary" onPress={open} />;
  }
  return (
    <View style={styles.row}>
      <Text style={type.secondary}>Time</Text>
      <DateTimePicker
        accessibilityLabel={label}
        value={toDate(value)}
        mode="time"
        display="compact"
        themeVariant="dark"
        accentColor={colors.gold}
        onChange={pick}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
