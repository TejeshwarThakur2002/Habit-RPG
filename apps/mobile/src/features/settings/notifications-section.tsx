import { Button, borders, colors, radii, type } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

import type { NotificationAccess } from '@/lib/notifications';

export interface NotificationsSectionProps {
  /** Null while the phone is still being asked. */
  access: NotificationAccess | null;
  hintSeen: boolean;
  onTurnOn: () => void;
  onOpenPhoneSettings: () => void;
  onDismissHint: () => void;
}

const STATUS: Record<NotificationAccess, string> = {
  granted: 'On. Quest reminders arrive at the times you set.',
  undetermined: 'Not set up yet. Turn them on to get quest reminders.',
  denied: "Off. Quest reminders won't arrive until you allow them in your phone's Settings.",
};

/** SCOPE.md section 5.8 "notification permission status", and F9's one-time hint. */
export function NotificationsSection(props: NotificationsSectionProps) {
  const { access } = props;
  if (access === null) return null;
  return (
    <View style={styles.section}>
      {access === 'denied' && !props.hintSeen && (
        <View accessibilityLiveRegion="polite" style={styles.hint}>
          <Text style={type.bodyStrong}>Reminders need notifications</Text>
          <Text style={type.secondary}>
            Habit RPG keeps working without them, but quest reminders stay silent. You can allow
            notifications any time in your phone&apos;s Settings.
          </Text>
          <Button label="Got it" variant="ghost" onPress={props.onDismissHint} />
        </View>
      )}
      <Text style={type.secondary}>{STATUS[access]}</Text>
      {access === 'undetermined' && (
        <Button label="Turn on notifications" variant="secondary" onPress={props.onTurnOn} />
      )}
      {access === 'denied' && (
        <Button
          label="Open phone Settings"
          variant="secondary"
          onPress={props.onOpenPhoneSettings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  hint: {
    gap: 6,
    padding: 12,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
});
