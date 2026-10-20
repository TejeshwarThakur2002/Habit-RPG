import { BOSS_NAMES, type BossKey } from '@habit-rpg/game-core';
import { MIN_TOUCH, borders, colors, fonts, radii, type } from '@habit-rpg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BossSummary } from '@/db/queries/quest-board';

/**
 * SCOPE.md section 5.4, item 6: the party boss at a glance, linking to the Party tab, or a
 * "Start or join a party" card when the hero has no party.
 */
export function BossMiniCard({ boss, onPress }: { boss: BossSummary | null; onPress: () => void }) {
  if (!boss) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Start or join a party"
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText}>+</Text>
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Start or join a party</Text>
          <Text style={type.meta}>Team up to fight a weekly boss</Text>
        </View>
      </Pressable>
    );
  }

  const name = BOSS_NAMES[boss.bossKey as BossKey] ?? boss.bossKey;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Party boss: ${name}, ${boss.hpPercent}% health left. Opens the Party tab`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Party boss: {name}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${boss.hpPercent}%` }]} />
        </View>
      </View>
      <Text style={type.meta}>{boss.hpPercent}% HP</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: MIN_TOUCH + 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bossCardBg,
  },
  iconText: { fontFamily: fonts.pixelMedium, fontSize: 18, color: colors.bossGreen },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  track: { height: 6, borderRadius: radii.bar, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.bossGreen },
});
