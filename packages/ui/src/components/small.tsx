// Small display components from SCOPE.md section 5.2: Chip, StatChip and ScreenHeader.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH, colors, radii, type, type ColorToken } from '../tokens';

/** A 10 px coloured square and text, for gold and streak. */
export function Chip({ color, label }: { color: ColorToken; label: string }) {
  return (
    <View style={styles.chip}>
      <View style={[styles.square, { backgroundColor: colors[color] }]} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export interface StatChipProps {
  label: string;
  value: number | string;
  /** Opens the "how this stat works" tooltip. */
  onPress?: () => void;
}

/** A `surface-2` tile: a 12 px muted label over a Pixelify 16 value. */
export function StatChip({ label, value, onPress }: StatChipProps) {
  const content = (
    <>
      <Text style={type.meta}>{label}</Text>
      <Text style={type.statValue}>{value}</Text>
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label} ${value}`} style={styles.statChip}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityHint={`Explains how ${label} is gained`}
      onPress={onPress}
      style={[styles.statChip, styles.pressable]}
    >
      {content}
    </Pressable>
  );
}

/** Gold Pixelify title on the left, with an optional pill or icon button on the right. */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={type.screenTitle}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  square: { width: 10, height: 10, borderRadius: radii.bar },
  chipText: { ...type.meta, color: colors.text },
  statChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.surface2,
  },
  pressable: { minHeight: MIN_TOUCH },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
