import {
  Button,
  ScreenHeader,
  SegmentedControl,
  colors,
  spacing,
  type,
  type ReduceMotionSetting,
} from '@habit-rpg/ui';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeroSection, type HeroFields } from './hero-section';
import { NotificationsSection, type NotificationsSectionProps } from './notifications-section';

/** The demo, playing without an account (D19), or signed in with email (D33). */
export type AccountMode = 'demo' | 'local' | 'account';

export interface SettingsViewProps {
  hero: HeroFields;
  deviceTimeZone: string;
  reduceMotion: ReduceMotionSetting;
  mode: AccountMode;
  /** The signed-in email, shown in account mode. */
  email: string | null;
  version: string;
  notifications: NotificationsSectionProps;
  onSaveHero: (fields: HeroFields) => void;
  onReduceMotion: (value: ReduceMotionSetting) => void;
  onSignOut: () => void;
  /** Opens "Link an account" for a hero made without one (D34). */
  onLinkAccount: () => void;
  onClose: () => void;
}

const MOTION_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const;

function accountCopy(mode: AccountMode, email: string | null) {
  if (mode === 'demo') {
    return {
      text: 'This is the demo hero. Leaving clears the sample data from this phone.',
      button: 'Leave the demo',
    };
  }
  if (mode === 'account') {
    // Honest until sync arrives (P4): the hero is still only on this phone.
    return {
      text: `Signed in as ${email ?? 'your email'}. Your hero is saved on this phone; syncing it to your account comes in a later update.`,
      button: 'Sign out',
    };
  }
  return {
    text: 'You are playing without an account, so your hero is saved only on this phone. Link an account to keep it, or sign out to delete it.',
    button: 'Sign out',
  };
}

/** SCOPE.md section 5.8 Settings, opened from the gear on Stats. */
export function SettingsView(props: SettingsViewProps) {
  const account = accountCopy(props.mode, props.email);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Settings"
        right={<Button label="Done" variant="ghost" onPress={props.onClose} />}
      />

      <Section title="Hero">
        <HeroSection
          saved={props.hero}
          deviceTimeZone={props.deviceTimeZone}
          onSave={props.onSaveHero}
        />
      </Section>

      <Section title="Reduce motion">
        <SegmentedControl
          label="Reduce motion"
          options={MOTION_OPTIONS}
          value={props.reduceMotion}
          onChange={props.onReduceMotion}
        />
        <Text style={type.secondary}>
          System follows your phone&apos;s setting. On turns off bouncing, confetti and floating
          rewards. Haptics stay on.
        </Text>
      </Section>

      <Section title="Notifications">
        <NotificationsSection {...props.notifications} />
      </Section>

      <Section title="Account">
        <Text style={type.secondary}>{account.text}</Text>
        {props.mode === 'local' && (
          <Button label="Link an account" variant="secondary" onPress={props.onLinkAccount} />
        )}
        <Button label={account.button} variant="danger" onPress={props.onSignOut} />
      </Section>

      <Section title="About">
        <Text style={type.secondary}>Habit RPG version {props.version}</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={type.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, padding: spacing.screenX, paddingBottom: 48 },
  section: { gap: 10 },
});
