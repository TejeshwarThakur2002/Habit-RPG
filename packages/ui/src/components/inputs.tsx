// Form controls from SCOPE.md section 5.2: TextField and SegmentedControl.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TOUCH, borders, colors, fonts, radii, type } from '../tokens';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown in red under the field and read out by screen readers. */
  error?: string | null;
  /** Helper text under the field when there is no error. */
  hint?: string;
}

export function TextField({ label, error, hint, maxLength, value, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const count = maxLength != null ? `${value?.length ?? 0} / ${maxLength}` : null;
  const help = error ?? hint;
  return (
    <View style={styles.field}>
      <Text style={type.secondary}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        value={value}
        maxLength={maxLength}
        placeholderTextColor={colors.muted}
        selectionColor={colors.gold}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError]}
        {...rest}
      />
      {(help || count) && (
        <View style={styles.helpRow}>
          <Text
            accessibilityLiveRegion={error ? 'polite' : 'none'}
            style={[type.meta, styles.help, !!error && styles.errorText]}
          >
            {help}
          </Text>
          {count && <Text style={type.meta}>{count}</Text>}
        </View>
      )}
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers, e.g. "Habit type". */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Equal-width segments; the selected one is gold and announced as selected. */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const { label, options, value, onChange } = props;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segments}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.row,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  inputFocused: { borderColor: colors.gold },
  inputError: { borderColor: colors.red },
  helpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  help: { flex: 1 },
  errorText: { color: colors.red },
  segments: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: radii.row,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: radii.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.gold },
  segmentLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  segmentLabelSelected: { fontFamily: fonts.pixelMedium, color: colors.bg },
});
