import { Button, ScreenHeader, colors, spacing, type } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { updateSettings } from '@/db/queries/settings';

// Placeholder: onboarding (hero name, class, time zone) is the next Phase 2 PR. Only a
// half-finished demo can reach this screen today, so it offers a way back to sign-in.
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <ScreenHeader title="Create your hero" />
      <Text style={type.secondary}>Onboarding arrives in the next update.</Text>
      <Button
        label="Back to sign in"
        variant="secondary"
        onPress={() => updateSettings(db, { demoMode: false, onboardingDone: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.section,
    paddingHorizontal: spacing.screenX,
    backgroundColor: colors.bg,
  },
});
