import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { MIN_TOUCH, borders, colors, fonts, radii } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
}

/** SCOPE.md section 5.2 Button: primary, secondary, ghost and danger, all at least 44 tall. */
export function Button({ label, variant = 'primary', disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && variant === 'primary' && styles.primaryPressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Text style={[styles.label, labelStyles[variant], disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    borderWidth: borders.card,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.gold, borderColor: colors.gold },
  primaryPressed: { backgroundColor: colors.goldPressed, borderColor: colors.goldPressed },
  secondary: { borderColor: colors.borderStrong },
  ghost: {},
  danger: { borderColor: colors.red },
  disabled: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  disabledLabel: { color: colors.muted },
});

const labelStyles = StyleSheet.create({
  primary: { fontFamily: fonts.pixelMedium, color: colors.bg },
  secondary: { color: colors.text },
  ghost: { color: colors.gold },
  danger: { color: colors.red },
});
