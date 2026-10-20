import type { HeroClass } from '@habit-rpg/game-core';
import { HeroSprite } from '@habit-rpg/sprites';
import { borders, colors, radii, type } from '@habit-rpg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const CLASSES: { value: HeroClass; name: string; blurb: string }[] = [
  { value: 'knight', name: 'Knight', blurb: 'Steady and armoured' },
  { value: 'mage', name: 'Mage', blurb: 'Curious and clever' },
  { value: 'rogue', name: 'Rogue', blurb: 'Quick and sneaky' },
];

export interface ClassCardProps {
  value: HeroClass;
  name: string;
  blurb: string;
  selected: boolean;
  onSelect: (value: HeroClass) => void;
}

/** One choice in onboarding step 2. Classes are cosmetic in the MVP (SCOPE.md section 3). */
export function ClassCard({ value, name, blurb, selected, onSelect }: ClassCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${name}, ${blurb.toLowerCase()}`}
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect(value)}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={styles.sprite}>
        <HeroSprite heroClass={value} cell={6} label={`${name} sprite`} />
      </View>
      <Text style={[type.name, styles.center]}>{name}</Text>
      <Text style={[type.meta, styles.center]}>{blurb}</Text>
      {selected && <Text style={[type.reward, styles.chosen]}>Chosen</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.gold },
  sprite: {
    padding: 8,
    borderRadius: radii.row,
    backgroundColor: colors.surface2,
  },
  center: { textAlign: 'center' },
  chosen: { color: colors.gold },
});
