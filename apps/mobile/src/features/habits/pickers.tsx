import type { Category } from '@habit-rpg/game-core';
import { MIN_TOUCH, borders, colors, fonts, radii, type } from '@habit-rpg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const CATEGORIES: { value: Category; label: string; stat: string }[] = [
  { value: 'body', label: 'Body', stat: 'STR' },
  { value: 'mind', label: 'Mind', stat: 'INT' },
  { value: 'health', label: 'Health', stat: 'CON' },
  { value: 'none', label: 'None', stat: '' },
];

/** Category chips; the category decides which stat a habit trains (SCOPE.md section 3). */
export function CategoryPicker(props: { value: Category; onChange: (c: Category) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Category" style={styles.row}>
      {CATEGORIES.map(({ value, label, stat }) => {
        const selected = value === props.value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={stat ? `${label}, trains ${stat}` : label}
            accessibilityState={{ checked: selected }}
            onPress={() => props.onChange(value)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
            {stat !== '' && <Text style={type.label}>{stat}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const DAYS = [
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
  ['S', 'Sunday'],
] as const;

/** Seven toggles over the weekday bitmask, Monday = 1 ... Sunday = 64. */
export function WeekdayPicker(props: { value: number; onChange: (mask: number) => void }) {
  return (
    <View accessibilityLabel="Days" style={styles.days}>
      {DAYS.map(([short, name], i) => {
        const bit = 1 << i;
        const on = (props.value & bit) !== 0;
        return (
          <Pressable
            key={name}
            accessibilityRole="checkbox"
            accessibilityLabel={name}
            accessibilityState={{ checked: on }}
            onPress={() => props.onChange(props.value ^ bit)}
            style={[styles.day, on && styles.selected]}
          >
            <Text style={[styles.label, on && styles.labelSelected]}>{short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.gold, backgroundColor: colors.surface2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  labelSelected: { color: colors.text },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
