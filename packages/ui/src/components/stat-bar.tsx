import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../motion';
import { colors, motion, radii, type } from '../tokens';

export interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: 'red' | 'teal';
}

/**
 * Label and "value / max" over a 10 px bar (SCOPE.md section 5.2). Numbers are always shown,
 * so colour is never the only signal; the fill eases over 300 ms unless motion is reduced.
 */
export function StatBar({ label, value, max, color }: StatBarProps) {
  const reduceMotion = useReduceMotion();
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const width = useSharedValue(fraction);

  useEffect(() => {
    width.value = reduceMotion
      ? fraction
      : withTiming(fraction, { duration: motion.bar, easing: Easing.out(Easing.quad) });
  }, [fraction, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} of ${max}` }}
      style={styles.root}
    >
      <View style={styles.row}>
        <Text style={type.label}>{label}</Text>
        <Text style={type.label}>
          {value} / {max}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: colors[color] }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  track: {
    height: 10,
    borderRadius: radii.bar,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
