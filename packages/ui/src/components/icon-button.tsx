// The icon button for ScreenHeader's right slot (SCOPE.md section 5.2), first used by the
// gear on Stats (section 5.7).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';

import { MIN_TOUCH, borders, colors, radii } from '../tokens';

export interface IconButtonProps {
  /** Read out by screen readers, since the icon has no text. */
  label: string;
  hint?: string;
  onPress: () => void;
  children: ReactNode;
}

/** A 44 x 44 bordered square holding one icon. */
export function IconButton({ label, hint, onPress, children }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

/** A 22 pt cog with 2 pt lines, matching the tab bar's outline icons. */
export function GearIcon({ color = colors.text }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={5.5} stroke={color} strokeWidth={2} fill="none" />
      <G fill={color}>
        {TEETH.map((angle) => (
          <Rect
            key={angle}
            x={9.5}
            y={1}
            width={3}
            height={4}
            transform={`rotate(${angle} 11 11)`}
          />
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.button,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.surface2 },
});
