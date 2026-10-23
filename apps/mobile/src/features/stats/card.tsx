import { borders, colors, radii, spacing } from '@habit-rpg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** The Stats tab's surface card. */
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: spacing.cardPadding,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
