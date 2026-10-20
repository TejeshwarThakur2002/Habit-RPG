import { spacing, type } from '@habit-rpg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** A titled block on the dev gallery screen. */
export function GallerySection({ title, children }: { title: string; children: ReactNode }) {
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
  section: { gap: spacing.row },
});
