import { ScreenHeader, colors, spacing, type } from '@habit-rpg/ui';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Temporary tab content until each screen's own Phase 2 PR lands. */
export function TabPlaceholder(props: { title: string; note: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <ScreenHeader title={props.title} />
      <Text style={type.secondary}>{props.note}</Text>
      {props.children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 32 },
});
