import { HeroSprite } from '@habit-rpg/sprites';
import { Chip, StatBar, borders, colors, radii, type } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

import type { QuestBoard } from '@/db/queries/quest-board';

/** SCOPE.md section 5.4, item 2: sprite tile, name and level, HP and XP bars, gold and streak. */
export function HeroCard({ board }: { board: QuestBoard }) {
  return (
    <View style={styles.card}>
      <View style={styles.tile}>
        <HeroSprite
          heroClass={board.heroClass}
          equipped={board.equipped}
          cell={8}
          label={`${board.heroName}, a level ${board.level} ${board.heroClass}`}
        />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[type.name, styles.name]} numberOfLines={1}>
            {board.heroName}
          </Text>
          <Text style={type.meta}>Lv {board.level}</Text>
        </View>
        <StatBar label="HP" value={board.hp} max={board.maxHp} color="red" />
        <StatBar label="XP" value={board.xpInLevel} max={board.xpToNext} color="teal" />
        <View style={styles.chips}>
          <Chip color="gold" label={`${board.gold} gold`} />
          <Chip color="orange" label={`${board.streak}-day streak`} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: radii.heroCard,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tile: {
    width: 104,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    borderRadius: radii.row,
    backgroundColor: colors.surface2,
  },
  info: { flex: 1, minWidth: 0, gap: 8 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 2 },
});
